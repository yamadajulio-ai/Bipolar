import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import {
  findBestMatch,
  computeAbsoluteTimestamps,
  reconcileManualIntoExisting,
  withSerializableTransaction,
  MERGE_SELECT,
  type ExistingRecord,
} from "@/lib/sleepMerge";
import * as Sentry from "@sentry/nextjs";

/** Validate that a YYYY-MM-DD string is a real calendar date */
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Validate that HH:MM is a real clock time (00:00–23:59) */
function isRealTime(s: string): boolean {
  const [h, m] = s.split(":").map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

const sleepLogSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD")
    .check(z.refine(isRealDate, "Data inválida no calendário")),
  bedtime: z.string()
    .regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM")
    .check(z.refine(isRealTime, "Horário de dormir inválido")),
  wakeTime: z.string()
    .regex(/^\d{2}:\d{2}$/, "Horário deve ser HH:MM")
    .check(z.refine(isRealTime, "Horário de acordar inválido")),
  totalHours: z.number().min(0).max(24),
  quality: z.number().int().min(0).max(100),
  awakenings: z.number().int().min(0).max(10).optional(),
  hrv: z.number().int().min(1).max(300).optional(),
  heartRate: z.number().int().min(20).max(250).optional(),
  preRoutine: z.string().max(500).optional(),
  notes: z.string().max(280).optional(),
}).check(
  z.refine(
    (data) => data.bedtime !== data.wakeTime,
    "Horário de dormir e acordar não podem ser iguais",
  ),
  z.refine(
    (data) => {
      // Coherence check: totalHours should be within ±2h of the calculated interval
      const [bH, bM] = data.bedtime.split(":").map(Number);
      const [wH, wM] = data.wakeTime.split(":").map(Number);
      const bedMin = bH * 60 + bM;
      const wakeMin = wH * 60 + wM;
      const spanMin = bedMin > wakeMin ? (1440 - bedMin + wakeMin) : (wakeMin - bedMin);
      const spanHours = spanMin / 60;
      return Math.abs(data.totalHours - spanHours) <= 2;
    },
    "Duração informada é muito diferente do intervalo dormir→acordar",
  ),
);


export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 60 reads per minute per user
  if (!(await checkRateLimit(`sono_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      bedtime: true,
      wakeTime: true,
      totalHours: true,
      awakeMinutes: true,
      quality: true,
      perceivedQuality: true,
      awakenings: true,
      hrv: true,
      heartRate: true,
      excluded: true,
      source: true,
      fieldProvenance: true,
      preRoutine: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json(logs, {
    headers: { "Cache-Control": "private, no-cache" },
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 30 writes per minute per user
  if (!(await checkRateLimit(`sono_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  // Body size limit: reject payloads > 100KB (manual form data is tiny)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 100_000) {
    return NextResponse.json(
      { error: "Payload muito grande" },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "JSON inválido" },
      { status: 400 },
    );
  }

  try {
    const parsed = sleepLogSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    // Server-side stripping: only use declared fields (never trust hrv/heartRate
    // from client to overwrite wearable data — reconciler handles this)
    const manualInput = {
      bedtime: parsed.data.bedtime,
      wakeTime: parsed.data.wakeTime,
      totalHours: parsed.data.totalHours,
      quality: parsed.data.quality,
      awakenings: parsed.data.awakenings ?? 0,
      hrv: parsed.data.hrv ?? null,
      heartRate: parsed.data.heartRate ?? null,
      preRoutine: parsed.data.preRoutine || null,
      notes: parsed.data.notes || null,
    };

    // All read→match→reconcile→write inside Serializable transaction (race-safe)
    const log = await withSerializableTransaction(prisma, async (tx) => {
      const txPrisma = tx as typeof prisma;

      // Find existing records for this date
      const existing = await txPrisma.sleepLog.findMany({
        where: { userId: session.userId, date: parsed.data.date },
        select: MERGE_SELECT,
      });

      // Find best matching record using interval overlap
      const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(
        parsed.data.date, parsed.data.bedtime, parsed.data.wakeTime,
      );
      const matchResult = findBestMatch(
        { bedtime: parsed.data.bedtime, bedtimeAt, wakeTimeAt },
        existing,
      );

      const existingRecord = matchResult?.match as ExistingRecord | undefined ?? null;

      // Reconcile: manual into existing (may be wearable)
      const result = reconcileManualIntoExisting(
        manualInput,
        existingRecord,
        parsed.data.date,
        undefined,
        matchResult?.overlapScore,
      );

      // finalBedtime may differ from parsed.data.bedtime when wearable timing is preserved
      const finalBedtime = result.data.bedtime as string;

      // Delete old record if bedtime changed (only when not wearable overlay)
      for (const op of result.operations) {
        if (op.type === "delete") {
          await txPrisma.sleepLog.delete({ where: { id: op.id } });
        }
      }

      // Also delete any other overlapping records with different bedtime
      // Use final reconciled interval (not raw user input) for correct overlap detection
      const finalBedtimeAt = result.data.bedtimeAt as Date;
      const finalWakeTimeAt = result.data.wakeTimeAt as Date;
      const overlapping = existing.filter((e) =>
        e.id !== existingRecord?.id &&
        e.bedtime !== finalBedtime &&
        findBestMatch(
          { bedtime: finalBedtime, bedtimeAt: finalBedtimeAt, wakeTimeAt: finalWakeTimeAt },
          [e],
        ) !== null,
      );
      if (overlapping.length > 0) {
        await txPrisma.sleepLog.deleteMany({
          where: { id: { in: overlapping.map((e) => e.id) } },
        });
      }

      // Upsert the reconciled record using final bedtime (wearable-preserved or manual)
      return txPrisma.sleepLog.upsert({
        where: {
          userId_date_bedtime: {
            userId: session.userId,
            date: parsed.data.date,
            bedtime: finalBedtime,
          },
        },
        update: result.data as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        create: { userId: session.userId, date: parsed.data.date, ...result.data } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        select: {
          id: true,
          date: true,
          bedtime: true,
          wakeTime: true,
          totalHours: true,
          awakeMinutes: true,
          quality: true,
          perceivedQuality: true,
          awakenings: true,
          hrv: true,
          heartRate: true,
          excluded: true,
          source: true,
          fieldProvenance: true,
          preRoutine: true,
          notes: true,
          createdAt: true,
        },
      });
    });

    return NextResponse.json(log, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sono" } });
    return NextResponse.json(
      { error: "Erro ao salvar registro de sono." },
      { status: 500 },
    );
  }
}
