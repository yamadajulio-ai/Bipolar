import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma, withRetry } from "@/lib/db";
import { buildDailyActivitySummary } from "@/lib/activity/summary";

/**
 * ADR-011 Movimento e Ritmo — Shadow-mode job.
 *
 * Runs daily around 04:00 America/Sao_Paulo (07:00 UTC) to compute
 * DailyActivitySummary for every user who has active `physical_activity`
 * consent and either a PhysicalActivitySession or a steps HealthMetric
 * for the target date.
 *
 * "Shadow mode" = we compute features + baseline + zScore and persist them,
 * but DO NOT fire user-facing alerts or risk escalations. This lasts 6-8
 * weeks while we validate against SleepLog / MoodSnapshot / ASRM / PHQ-9.
 * Risk-v2 integration is gated by a separate feature flag.
 */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (
    !process.env.CRON_SECRET ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "activity-shadow", status: "in_progress" },
    {
      schedule: { type: "crontab", value: "0 7 * * *" },
      checkinMargin: 10,
      maxRuntime: 15,
      timezone: "Etc/UTC",
    },
  );

  try {
    // Target date = yesterday in America/Sao_Paulo, to ensure all of yesterday's
    // data has been ingested. Using toLocaleDateString with sv-SE for stable ISO format.
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const targetDate = yesterday.toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });

    // Eligible users: have consent AND have either a session or steps for targetDate.
    // We fetch all consenters, then inner-filter by data presence.
    const consenters = await withRetry(() =>
      prisma.consent.findMany({
        where: { scope: "physical_activity", revokedAt: null },
        select: { userId: true },
      }),
    );

    let processed = 0;
    let skippedNoData = 0;
    const errors: Array<{ userId: string; message: string }> = [];

    for (const { userId } of consenters) {
      try {
        const [hasSession, hasSteps] = await Promise.all([
          prisma.physicalActivitySession.findFirst({
            where: { userId, localDate: targetDate },
            select: { id: true },
          }),
          prisma.healthMetric.findFirst({
            where: { userId, date: targetDate, metric: "steps" },
            select: { id: true },
          }),
        ]);

        if (!hasSession && !hasSteps) {
          skippedNoData++;
          continue;
        }

        const summary = await buildDailyActivitySummary({
          userId,
          localDate: targetDate,
          prisma,
        });

        await prisma.dailyActivitySummary.upsert({
          where: { userId_localDate: { userId, localDate: targetDate } },
          update: {
            steps: summary.steps,
            sessionCount: summary.sessionCount,
            sessionMinutesLight: summary.sessionMinutesLight,
            sessionMinutesModerate: summary.sessionMinutesModerate,
            sessionMinutesVigorous: summary.sessionMinutesVigorous,
            lateSessionMinutes: summary.lateSessionMinutes,
            lastSessionEndRelativeToHabitualSleepMin:
              summary.lastSessionEndRelativeToHabitualSleepMin,
            activityLoad: summary.activityLoad,
            dataCompleteness: summary.dataCompleteness,
            sourceMix: summary.sourceMix,
            baseline28d: summary.baseline28d,
            baseline28dMad: summary.baseline28dMad,
            weekendAdjustedBaseline: summary.weekendAdjustedBaseline,
            zScore: summary.zScore,
            computedAt: new Date(),
          },
          create: {
            userId,
            localDate: targetDate,
            steps: summary.steps,
            sessionCount: summary.sessionCount,
            sessionMinutesLight: summary.sessionMinutesLight,
            sessionMinutesModerate: summary.sessionMinutesModerate,
            sessionMinutesVigorous: summary.sessionMinutesVigorous,
            lateSessionMinutes: summary.lateSessionMinutes,
            lastSessionEndRelativeToHabitualSleepMin:
              summary.lastSessionEndRelativeToHabitualSleepMin,
            activityLoad: summary.activityLoad,
            dataCompleteness: summary.dataCompleteness,
            sourceMix: summary.sourceMix,
            baseline28d: summary.baseline28d,
            baseline28dMad: summary.baseline28dMad,
            weekendAdjustedBaseline: summary.weekendAdjustedBaseline,
            zScore: summary.zScore,
          },
        });

        processed++;
      } catch (err) {
        errors.push({
          userId,
          message: err instanceof Error ? err.message.slice(0, 120) : "unknown",
        });
      }
    }

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "activity-shadow",
      status: errors.length > 0 ? "error" : "ok",
    });

    if (errors.length > 0) {
      Sentry.captureMessage("activity-shadow: some users failed", {
        level: "warning",
        extra: { errorCount: errors.length, sample: errors.slice(0, 5) },
      });
    }

    return NextResponse.json({
      ok: true,
      targetDate,
      eligibleUsers: consenters.length,
      processed,
      skippedNoData,
      errorCount: errors.length,
    });
  } catch (err) {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: "activity-shadow",
      status: "error",
    });
    Sentry.captureException(err, { tags: { endpoint: "cron-activity-shadow" } });
    return NextResponse.json({ error: "Shadow compute failed" }, { status: 500 });
  }
}
