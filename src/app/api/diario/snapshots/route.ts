import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import { projectSnapshots } from "@/lib/diary/projectSnapshots";
import * as Sentry from "@sentry/nextjs";

const snapshotSchema = z.object({
  mood: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  anxiety: z.number().int().min(1).max(5),
  irritability: z.number().int().min(1).max(5),
  warningSignsNow: z.string().optional(),
  note: z.string().max(280).optional(),
  clientRequestId: z.string().min(1).max(100),

  // Optional daily fields (only on first check-in or explicit edit)
  sleepHours: z.number().min(0).max(24).optional(),
  tookMedication: z.enum(["sim", "nao", "nao_sei"]).optional(),
});

/** POST /api/diario/snapshots — create a mood snapshot */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`snapshot_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
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
      select: { id: true, diaryEntryId: true },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, deduplicated: true }, { status: 200 });
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
        mood: parsed.data.mood,
        sleepHours: parsed.data.sleepHours ?? 0,
        energyLevel: parsed.data.energy,
        anxietyLevel: parsed.data.anxiety,
        irritability: parsed.data.irritability,
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
        mood: parsed.data.mood,
        energy: parsed.data.energy,
        anxiety: parsed.data.anxiety,
        irritability: parsed.data.irritability,
        warningSignsNow: parsed.data.warningSignsNow ?? null,
        note: parsed.data.note ?? null,
      },
    });

    // Update daily fields if provided
    const dailyUpdate: Record<string, unknown> = {};
    if (parsed.data.sleepHours !== undefined) {
      dailyUpdate.sleepHours = parsed.data.sleepHours;
    }
    if (parsed.data.tookMedication !== undefined) {
      dailyUpdate.tookMedication = parsed.data.tookMedication;
    }

    // Fetch all snapshots for today and re-project
    const allSnapshots = await prisma.moodSnapshot.findMany({
      where: { diaryEntryId: entry.id },
      orderBy: { capturedAt: "asc" },
    });

    const projection = projectSnapshots(allSnapshots);
    if (projection) {
      await prisma.diaryEntry.update({
        where: { id: entry.id },
        data: {
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
          ...dailyUpdate,
        },
      });
    }

    return NextResponse.json({
      id: snapshot.id,
      snapshotCount: allSnapshots.length,
      capturedAt: snapshot.capturedAt,
    }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "diario/snapshots" } });
    return NextResponse.json(
      { error: "Erro ao salvar registro." },
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
      mood: true,
      energy: true,
      anxiety: true,
      irritability: true,
      warningSignsNow: true,
      note: true,
    },
  });

  return NextResponse.json(snapshots);
}
