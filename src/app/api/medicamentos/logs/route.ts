import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const logSchema = z.object({
  scheduleId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["TAKEN", "MISSED"]),
  source: z.enum(["QUICK_CHECKIN", "FULL_DIARY", "MEDICATION_PAGE"]).optional(),
});

const batchLogSchema = z.object({
  logs: z.array(logSchema).min(1).max(20),
});

/** POST /api/medicamentos/logs — batch log medication doses */
export async function POST(request: NextRequest) {
  const start = performance.now();

  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`med_log:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parsed = batchLogSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Verify all schedules belong to user's medications (single query)
    const scheduleIds = [...new Set(parsed.data.logs.map((l) => l.scheduleId))];
    const schedules = await prisma.medicationSchedule.findMany({
      where: { id: { in: scheduleIds } },
      include: { medication: { select: { userId: true, id: true } } },
    });

    const scheduleMap = new Map(schedules.map((s) => [s.id, s]));
    for (const log of parsed.data.logs) {
      const schedule = scheduleMap.get(log.scheduleId);
      if (!schedule || schedule.medication.userId !== session.userId) {
        return NextResponse.json({ error: "Horário não encontrado" }, { status: 404 });
      }
    }

    // Batch all upserts + legacy updates in a single transaction
    const dates = [...new Set(parsed.data.logs.map((l) => l.date))];
    const results = await prisma.$transaction(async (tx) => {
      // Upsert all logs in parallel (idempotent by scheduleId + date)
      const upserted = await Promise.all(
        parsed.data.logs.map((log) => {
          const schedule = scheduleMap.get(log.scheduleId)!;
          return tx.medicationLog.upsert({
            where: { scheduleId_date: { scheduleId: log.scheduleId, date: log.date } },
            update: {
              status: log.status,
              takenAt: log.status === "TAKEN" ? new Date() : null,
              source: log.source ?? "MEDICATION_PAGE",
            },
            create: {
              userId: session.userId,
              medicationId: schedule.medication.id,
              scheduleId: log.scheduleId,
              date: log.date,
              status: log.status,
              scheduledTimeLocal: schedule.timeLocal,
              takenAt: log.status === "TAKEN" ? new Date() : null,
              source: log.source ?? "MEDICATION_PAGE",
            },
          });
        }),
      );

      // Update legacy tookMedication on DiaryEntry for backward compat (inside transaction)
      await Promise.all(
        dates.map((date) => updateLegacyMedication(tx, session.userId, date)),
      );

      return upserted;
    });

    const elapsed = Math.round(performance.now() - start);
    const res = NextResponse.json({ count: results.length }, { status: 201 });
    res.headers.set("Server-Timing", `total;dur=${elapsed}`);
    return res;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "medicamentos_logs" } });
    return NextResponse.json({ error: "Erro ao salvar registro." }, { status: 500 });
  }
}

/**
 * Derive legacy tookMedication value from detailed logs.
 * all TAKEN → "sim", all MISSED → "nao", partial/pending → "nao_sei"
 * Accepts a Prisma transaction client to run inside a batch transaction.
 */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function updateLegacyMedication(tx: TxClient, userId: string, date: string) {
  // Get all expected schedules for this date
  const activeMeds = await tx.medication.findMany({
    where: {
      userId,
      isActive: true,
      isAsNeeded: false,
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    include: {
      schedules: {
        where: {
          effectiveFrom: { lte: date },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }],
        },
      },
    },
  });

  const allScheduleIds = activeMeds.flatMap((m) => m.schedules.map((s) => s.id));
  if (allScheduleIds.length === 0) return;

  const logs = await tx.medicationLog.findMany({
    where: { userId, date, scheduleId: { in: allScheduleIds } },
  });

  let legacy: string;
  if (logs.length === 0) {
    return; // No logs yet, don't overwrite
  } else if (logs.length < allScheduleIds.length) {
    legacy = "nao_sei"; // Partial
  } else if (logs.every((l) => l.status === "TAKEN")) {
    legacy = "sim";
  } else if (logs.every((l) => l.status === "MISSED")) {
    legacy = "nao";
  } else {
    legacy = "nao_sei"; // Mixed
  }

  await tx.diaryEntry.updateMany({
    where: { userId, date },
    data: { tookMedication: legacy },
  });
}
