/**
 * Shadow-mode summary builder (ADR-011 Movimento e Ritmo).
 *
 * Computes DailyActivitySummary for a single user/day by combining:
 *   - PhysicalActivitySession rows (intentional movement)
 *   - HealthMetric rows (steps, ativação global)
 *   - SleepLog (habitual bedtime + completeness signal)
 *
 * Fase 1: runs in shadow mode (no user-facing output, no risk triggers).
 * Risk engine integration is gated behind a feature flag until backtest.
 */

import type { PrismaClient, Prisma } from "@prisma/client";
import { computeDailyActivityLoad, type ActivitySessionInput } from "./activityLoad";
import { computeBaseline28d, type DailyLoadPoint } from "./baseline";
import { computeDataCompleteness } from "./completeness";

const TZ = "America/Sao_Paulo";

export interface BuildSummaryOptions {
  userId: string;
  localDate: string;   // YYYY-MM-DD in TZ
  prisma: PrismaClient | Prisma.TransactionClient;
}

// Return shape used by the shadow-mode cron job to upsert DailyActivitySummary.
export interface BuiltSummary {
  localDate: string;
  steps: number | null;
  sessionCount: number;
  sessionMinutesLight: number;
  sessionMinutesModerate: number;
  sessionMinutesVigorous: number;
  lateSessionMinutes: number;
  lastSessionEndRelativeToHabitualSleepMin: number | null;
  activityLoad: number;
  dataCompleteness: number;
  sourceMix: Record<string, number>;
  baseline28d: number | null;
  baseline28dMad: number | null;
  weekendAdjustedBaseline: number | null;
  zScore: number | null;
}

export async function buildDailyActivitySummary(
  opts: BuildSummaryOptions,
): Promise<BuiltSummary> {
  const { userId, localDate, prisma } = opts;

  // 1. Sessions for this local date
  const sessions = await prisma.physicalActivitySession.findMany({
    where: { userId, localDate },
    select: {
      startAtUtc: true,
      endAtUtc: true,
      durationSec: true,
      intensityBand: true,
      activityTypeNorm: true,
      avgHr: true,
      source: true,
    },
  });

  // 2. Steps for this date (ativação global signal, independent from sessions)
  const stepsMetric = await prisma.healthMetric.findFirst({
    where: { userId, date: localDate, metric: "steps" },
    select: { value: true },
  });
  const steps = stepsMetric ? Math.round(stepsMetric.value) : null;

  // 3. SleepLog for this date — gives habitual bedtime (used for lateness).
  //    We use 28-day median bedtime, not today's bedtime, because today might
  //    be anomalous (which is exactly what we're trying to detect).
  const recentSleepLogs = await prisma.sleepLog.findMany({
    where: { userId, date: { lte: localDate }, excluded: false },
    select: { date: true, bedtime: true, hrv: true, heartRate: true },
    orderBy: { date: "desc" },
    take: 28,
  });
  const habitualSleepLocalMinutes = medianBedtimeMinutes(recentSleepLogs);

  // 4. Compute today's load
  const sessionInputs: ActivitySessionInput[] = sessions.map((s) => ({
    localDate,
    startAtUtc: s.startAtUtc,
    endAtUtc: s.endAtUtc,
    durationSec: s.durationSec,
    intensityBand: (s.intensityBand as "light" | "moderate" | "vigorous" | null) ?? undefined,
    activityTypeNorm: s.activityTypeNorm,
    avgHr: s.avgHr ?? undefined,
  }));

  const loadResult = computeDailyActivityLoad(sessionInputs, habitualSleepLocalMinutes);

  // 5. Source mix — useful telemetry, not surfaced to user
  const sourceMix: Record<string, number> = {};
  for (const s of sessions) {
    sourceMix[s.source] = (sourceMix[s.source] ?? 0) + 1;
  }

  // 6. Data completeness
  const todaySleep = recentSleepLogs.find((s) => s.date === localDate);
  const completeness = computeDataCompleteness({
    hasSteps: steps !== null,
    stepCount: steps,
    hasSleepLog: !!todaySleep,
    hasHrvOrHr: !!(todaySleep?.hrv || todaySleep?.heartRate),
    sessionCount: sessions.length,
    sourceMix,
  });

  // 7. Baseline (fetch last 28 days of DailyActivitySummary excluding today)
  const priorSummaries = await prisma.dailyActivitySummary.findMany({
    where: { userId, localDate: { lt: localDate } },
    select: { localDate: true, activityLoad: true, dataCompleteness: true },
    orderBy: { localDate: "desc" },
    take: 28,
  });

  const history: DailyLoadPoint[] = priorSummaries.map((p) => ({
    localDate: p.localDate,
    activityLoad: p.activityLoad,
    dataCompleteness: p.dataCompleteness,
    dayOfWeek: dayOfWeekForLocalDate(p.localDate),
  }));

  const todayPoint: DailyLoadPoint = {
    localDate,
    activityLoad: loadResult.activityLoad,
    dataCompleteness: completeness,
    dayOfWeek: dayOfWeekForLocalDate(localDate),
  };

  const baseline = computeBaseline28d(history, todayPoint);

  return {
    localDate,
    steps,
    sessionCount: sessions.length,
    sessionMinutesLight: loadResult.sessionMinutesLight,
    sessionMinutesModerate: loadResult.sessionMinutesModerate,
    sessionMinutesVigorous: loadResult.sessionMinutesVigorous,
    lateSessionMinutes: loadResult.lateSessionMinutes,
    lastSessionEndRelativeToHabitualSleepMin: loadResult.lastSessionEndRelativeToHabitualSleepMin,
    activityLoad: loadResult.activityLoad,
    dataCompleteness: completeness,
    sourceMix,
    baseline28d: baseline.baseline28d,
    baseline28dMad: baseline.baseline28dMad,
    weekendAdjustedBaseline: baseline.weekendAdjustedBaseline,
    zScore: baseline.zScore,
  };
}

function medianBedtimeMinutes(
  logs: Array<{ bedtime: string | null }>,
): number | null {
  const minutes: number[] = [];
  for (const l of logs) {
    if (!l.bedtime) continue;
    const parts = l.bedtime.split(":");
    if (parts.length < 2) continue;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
    // Treat early-morning bedtimes (00:00..03:59) as "next day" for comparison,
    // so 02:00 sorts as 1560 rather than 120 — clinically a 2am bedtime is LATE.
    const raw = h * 60 + m;
    minutes.push(h < 4 ? raw + 1440 : raw);
  }
  if (minutes.length === 0) return null;
  minutes.sort((a, b) => a - b);
  const mid = Math.floor(minutes.length / 2);
  const median =
    minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
  // Fold back into 0..1439 range for comparison with same-day session end times.
  return median % 1440;
}

function dayOfWeekForLocalDate(localDate: string): number {
  // Interpret as TZ-anchored date. We construct an ISO string with a fixed
  // midday hour to avoid DST edge cases, then read the weekday in TZ.
  const iso = `${localDate}T12:00:00`;
  const d = new Date(iso);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[name] ?? 0;
}
