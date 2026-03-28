import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import { projectSnapshots, AGGREGATION_VERSION } from "@/lib/diary/projectSnapshots";
import { isSnapshotEnabled } from "@/lib/featureFlags";
import { hasConsent } from "@/lib/consent";
import * as Sentry from "@sentry/nextjs";

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REPROJECT_MAX_RETRIES = 3;

/** Check if an error is a Prisma P2034 serialization failure */
function isSerializationFailure(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: string }).code === "P2034"
  );
}

/** Call reprojectEntry with retry on serialization conflicts (P2034) */
async function reprojectWithRetry(
  entryId: string,
  dailyUpdate?: Record<string, unknown>,
): Promise<number> {
  for (let attempt = 0; attempt < REPROJECT_MAX_RETRIES; attempt++) {
    try {
      return await reprojectEntry(entryId, dailyUpdate);
    } catch (err) {
      if (isSerializationFailure(err) && attempt < REPROJECT_MAX_RETRIES - 1) {
        Sentry.addBreadcrumb({
          category: "db.retry",
          message: `reprojectEntry serialization retry ${attempt + 1}/${REPROJECT_MAX_RETRIES} for entry ${entryId}`,
          level: "warning",
        });
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error("reprojectWithRetry: exhausted retries");
}

const snapshotSchema = z.object({
  feeling: z.number().int().min(1).max(5).optional(),
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  anxiety: z.number().int().min(1).max(5).optional(),
  irritability: z.number().int().min(1).max(5).optional(),
  warningSignsNow: z.string().max(2000).optional(),
  note: z.string().max(280).optional(),
  clientRequestId: z.string().min(1).max(100),

  // Optional daily fields (only on first check-in or explicit edit)
  sleepHours: z.number().min(0).max(24).optional(),
  tookMedication: z.enum(["sim", "nao", "nao_sei"]).optional(),
});

const editSchema = z.object({
  snapshotId: z.string().min(1),
  feeling: z.number().int().min(1).max(5).optional(),
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  anxiety: z.number().int().min(1).max(5).optional(),
  irritability: z.number().int().min(1).max(5).optional(),
  warningSignsNow: z.string().max(2000).optional(),
  note: z.string().max(280).optional(),
});

/** Helper: re-project all snapshots and update DiaryEntry.
 *  Wrapped in a serializable transaction to prevent race conditions
 *  when concurrent requests reproject the same entry. */
async function reprojectEntry(entryId: string, dailyUpdate?: Record<string, unknown>) {
  return prisma.$transaction(async (tx) => {
    const allSnapshots = await tx.moodSnapshot.findMany({
      where: { diaryEntryId: entryId },
      orderBy: { capturedAt: "asc" },
      select: {
        capturedAt: true,
        feeling: true,
        mood: true,
        energy: true,
        anxiety: true,
        irritability: true,
        warningSignsNow: true,
        note: true,
      },
    });

    const projection = projectSnapshots(allSnapshots);
    if (projection) {
      await tx.diaryEntry.update({
        where: { id: entryId },
        data: {
          feeling: projection.feeling,
          mood: projection.mood,
          energyLevel: projection.energyLevel,
          anxietyLevel: projection.anxietyLevel,
          irritability: projection.irritability,
          warningSigns: projection.warningSigns,
          note: projection.note,
          snapshotCount: projection.snapshotCount,
          firstSnapshotAt: projection.firstSnapshotAt,
          lastSnapshotAt: projection.lastSnapshotAt,
          moodRange: projection.moodRange,
          moodInstability: projection.moodInstability,
          anxietyPeak: projection.anxietyPeak,
          irritabilityPeak: projection.irritabilityPeak,
          morningEveningDelta: projection.morningEveningDelta,
          abruptShifts: projection.abruptShifts,
          aggregationVersion: AGGREGATION_VERSION,
          riskScoreCurrent: projection.riskScoreCurrent,
          riskScorePeak: projection.riskScorePeak,
          // Invalidate stale confirmation — projection changed, old confirmation is semantically invalid
          summaryConfirmedAt: null,
          ...dailyUpdate,
        },
      });
    }
    return allSnapshots.length;
  }, {
    isolationLevel: "Serializable",
  });
}

/** POST /api/diario/snapshots — create a mood snapshot */
export async function POST(request: NextRequest) {
  const start = performance.now();

  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!isSnapshotEnabled()) {
    return NextResponse.json({ error: "Recurso temporariamente indisponível" }, { status: 503 });
  }

  if (!(await checkRateLimit(`snapshot_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  // Consent gate: require "health_data" scope (LGPD Art. 11)
  if (!(await hasConsent(session.userId, "health_data"))) {
    return NextResponse.json(
      { error: "Consentimento para dados de saúde não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = snapshotSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const now = new Date();
    const todayStr = localDateStr(now);

    // Idempotency: if clientRequestId already exists, return existing
    const existing = await prisma.moodSnapshot.findUnique({
      where: { clientRequestId: parsed.data.clientRequestId },
      select: { id: true, diaryEntryId: true, capturedAt: true, diaryEntry: { select: { snapshotCount: true } } },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, snapshotCount: existing.diaryEntry.snapshotCount ?? 1, capturedAt: existing.capturedAt, deduplicated: true }, { status: 200 });
    }

    // Upsert DiaryEntry for today (creates if first check-in)
    const entry = await prisma.diaryEntry.upsert({
      where: {
        userId_date: { userId: session.userId, date: todayStr },
      },
      update: {
        mode: "AUTO_FROM_SNAPSHOT",
      },
      create: {
        userId: session.userId,
        date: todayStr,
        feeling: parsed.data.feeling ?? null,
        mood: parsed.data.mood,
        sleepHours: parsed.data.sleepHours ?? 0,
        energyLevel: parsed.data.energy,
        anxietyLevel: parsed.data.anxiety ?? null,
        irritability: parsed.data.irritability ?? null,
        tookMedication: parsed.data.tookMedication ?? null,
        warningSigns: parsed.data.warningSignsNow ?? null,
        mode: "AUTO_FROM_SNAPSHOT",
        snapshotCount: 0,
      },
    });

    // Create snapshot
    const snapshot = await prisma.moodSnapshot.create({
      data: {
        userId: session.userId,
        diaryEntryId: entry.id,
        capturedAt: now,
        localDate: todayStr,
        clientRequestId: parsed.data.clientRequestId,
        feeling: parsed.data.feeling ?? null,
        mood: parsed.data.mood,
        energy: parsed.data.energy,
        anxiety: parsed.data.anxiety ?? null,
        irritability: parsed.data.irritability ?? null,
        warningSignsNow: parsed.data.warningSignsNow ?? null,
        note: parsed.data.note ?? null,
      },
    });

    // Build daily update from optional fields
    const dailyUpdate: Record<string, unknown> = {};
    if (parsed.data.sleepHours !== undefined) {
      dailyUpdate.sleepHours = parsed.data.sleepHours;
    }
    if (parsed.data.tookMedication !== undefined) {
      dailyUpdate.tookMedication = parsed.data.tookMedication;
    }

    const count = await reprojectWithRetry(entry.id, dailyUpdate);

    const elapsed = Math.round(performance.now() - start);
    const res = NextResponse.json({
      id: snapshot.id,
      snapshotCount: count,
      capturedAt: snapshot.capturedAt,
    }, { status: 201 });
    res.headers.set("Server-Timing", `total;dur=${elapsed}`);
    return res;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "diario/snapshots" } });
    return NextResponse.json(
      { error: "Erro ao salvar registro." },
      { status: 500 },
    );
  }
}

/** PATCH /api/diario/snapshots — edit the last snapshot within 15-min window */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!isSnapshotEnabled()) {
    return NextResponse.json({ error: "Recurso temporariamente indisponível" }, { status: 503 });
  }

  if (!(await checkRateLimit(`snapshot_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  // Consent gate: require "health_data" scope (LGPD Art. 11)
  if (!(await hasConsent(session.userId, "health_data"))) {
    return NextResponse.json(
      { error: "Consentimento para dados de saúde não concedido. Acesse Privacidade para autorizar." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const parsed = editSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Fetch the snapshot
    const snapshot = await prisma.moodSnapshot.findUnique({
      where: { id: parsed.data.snapshotId },
      select: {
        id: true,
        userId: true,
        diaryEntryId: true,
        receivedAt: true,
        localDate: true,
      },
    });

    if (!snapshot || snapshot.userId !== session.userId) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    // Check 15-min edit window — anchored to server-side receivedAt only
    // Legacy snapshots without receivedAt cannot be edited (no trusted anchor)
    if (!snapshot.receivedAt) {
      return NextResponse.json(
        { error: "Este registro não suporta edição (registrado antes da funcionalidade)" },
        { status: 403 },
      );
    }
    const elapsed = Date.now() - snapshot.receivedAt.getTime();
    if (elapsed > EDIT_WINDOW_MS) {
      return NextResponse.json(
        { error: "Janela de edição expirou (limite: 15 minutos)" },
        { status: 403 },
      );
    }

    // Check it's the latest snapshot for that day
    const latestForDay = await prisma.moodSnapshot.findFirst({
      where: { userId: session.userId, localDate: snapshot.localDate },
      orderBy: { capturedAt: "desc" },
      select: { id: true },
    });

    if (latestForDay?.id !== snapshot.id) {
      return NextResponse.json(
        { error: "Apenas o último registro do dia pode ser editado" },
        { status: 403 },
      );
    }

    // Build update
    const updateData: Record<string, unknown> = {};
    if (parsed.data.feeling !== undefined) updateData.feeling = parsed.data.feeling;
    if (parsed.data.mood !== undefined) updateData.mood = parsed.data.mood;
    if (parsed.data.energy !== undefined) updateData.energy = parsed.data.energy;
    if (parsed.data.anxiety !== undefined) updateData.anxiety = parsed.data.anxiety;
    if (parsed.data.irritability !== undefined) updateData.irritability = parsed.data.irritability;
    if (parsed.data.warningSignsNow !== undefined) updateData.warningSignsNow = parsed.data.warningSignsNow;
    if (parsed.data.note !== undefined) updateData.note = parsed.data.note;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
    }

    const updated = await prisma.moodSnapshot.update({
      where: { id: snapshot.id },
      data: updateData,
      select: {
        id: true,
        capturedAt: true,
        feeling: true,
        mood: true,
        energy: true,
        anxiety: true,
        irritability: true,
        warningSignsNow: true,
        note: true,
      },
    });

    // Re-project
    await reprojectWithRetry(snapshot.diaryEntryId);

    return NextResponse.json({ updated: true, snapshot: updated });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "diario/snapshots/patch" } });
    return NextResponse.json(
      { error: "Erro ao editar registro." },
      { status: 500 },
    );
  }
}

/** GET /api/diario/snapshots?date=YYYY-MM-DD — get snapshots for a day */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`snapshot_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || localDateStr(new Date());

  const snapshots = await prisma.moodSnapshot.findMany({
    where: { userId: session.userId, localDate: date },
    orderBy: { capturedAt: "asc" },
    select: {
      id: true,
      capturedAt: true,
      receivedAt: true,
      feeling: true,
      mood: true,
      energy: true,
      anxiety: true,
      irritability: true,
      warningSignsNow: true,
      note: true,
    },
  });

  const res = NextResponse.json(snapshots);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
