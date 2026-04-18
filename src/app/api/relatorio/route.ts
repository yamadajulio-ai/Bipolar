import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localToday } from "@/lib/dateUtils";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`relatorio_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Parâmetro month inválido (YYYY-MM)" }, { status: 400 });
  }

  const startDate = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);

  // Reject unreasonable year ranges to prevent inefficient queries
  const currentYear = parseInt(localToday().slice(0, 4), 10);
  if (year < 2020 || year > currentYear + 1) {
    return NextResponse.json({ error: "Ano fora do intervalo permitido" }, { status: 400 });
  }
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const endDate = `${nextMonth}-01`;

  let entries, sleepLogs, exerciseSessions, weeklyAssessments, lifeChartEvents, functioningAssessments;
  try {
    [entries, sleepLogs, exerciseSessions, weeklyAssessments, lifeChartEvents, functioningAssessments] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: startDate, lt: endDate } },
      orderBy: { date: "asc" },
      select: {
        id: true, date: true, mood: true, sleepHours: true, note: true,
        energyLevel: true, anxietyLevel: true, irritability: true,
        tookMedication: true, warningSigns: true, createdAt: true,
        mode: true, snapshotCount: true, moodRange: true, moodInstability: true,
        firstSnapshotAt: true, lastSnapshotAt: true,
        morningEveningDelta: true, abruptShifts: true,
        anxietyPeak: true, irritabilityPeak: true,
      },
    }),
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: startDate, lt: endDate } },
      orderBy: { date: "asc" },
      select: {
        id: true, date: true, bedtime: true, wakeTime: true,
        totalHours: true, quality: true, awakenings: true,
        hrv: true, heartRate: true, excluded: true, createdAt: true,
      },
    }),
    prisma.exerciseSession.findMany({
      where: { userId: session.userId, completedAt: { gte: new Date(startDate), lt: new Date(endDate) } },
      select: { id: true, completedAt: true },
    }),
    prisma.weeklyAssessment.findMany({
      where: { userId: session.userId, date: { gte: startDate, lt: endDate } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, asrmTotal: true, phq9Total: true, fastAvg: true, exerciseDaysPerWeek: true },
    }),
    prisma.lifeChartEvent.findMany({
      where: { userId: session.userId, date: { gte: startDate, lt: endDate } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, eventType: true, label: true },
    }),
    prisma.functioningAssessment.findMany({
      where: { userId: session.userId, date: { gte: startDate, lt: endDate } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, avgScore: true },
    }),
  ]);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "relatorio" } });
    return NextResponse.json({ error: "Erro ao buscar dados" }, { status: 500 });
  }

  // Aggregations
  const moods = entries.map((e) => e.mood);
  const sleeps = entries.map((e) => e.sleepHours).filter((h) => h > 0);
  const energies = entries.filter((e) => e.energyLevel).map((e) => e.energyLevel!);
  const anxieties = entries.filter((e) => e.anxietyLevel).map((e) => e.anxietyLevel!);

  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null);

  const moodDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  moods.forEach((m) => { moodDistribution[m] = (moodDistribution[m] || 0) + 1; });

  const medicationCount = entries.filter((e) => e.tookMedication === "sim").length;
  const medicationTotal = entries.filter((e) => e.tookMedication).length;

  // Warning signs frequency
  const warningSignsFreq: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.warningSigns) {
      try {
        const signs = JSON.parse(e.warningSigns) as string[];
        signs.forEach((s) => { warningSignsFreq[s] = (warningSignsFreq[s] || 0) + 1; });
      } catch { /* ignore */ }
    }
  });

  // Weekly assessment summaries
  const asrmScoresArr = weeklyAssessments.filter((w) => w.asrmTotal !== null).map((w) => w.asrmTotal!);
  const phq9ScoresArr = weeklyAssessments.filter((w) => w.phq9Total !== null).map((w) => w.phq9Total!);
  const fastScoresArr = functioningAssessments.filter((f) => f.avgScore !== null).map((f) => f.avgScore!);

  // Life chart event type counts
  const eventTypeCounts: Record<string, number> = {};
  lifeChartEvents.forEach((e) => {
    eventTypeCounts[e.eventType] = (eventTypeCounts[e.eventType] || 0) + 1;
  });

  const response = NextResponse.json({
    month,
    stats: {
      totalDiaryEntries: entries.length,
      totalSleepLogs: sleepLogs.length,
      totalExercises: exerciseSessions.length,
      avgMood: avg(moods),
      avgSleep: avg(sleeps),
      avgEnergy: avg(energies),
      avgAnxiety: avg(anxieties),
      avgSleepQuality: avg(sleepLogs.map((s) => s.quality)),
      moodDistribution,
      medicationAdherence: medicationTotal > 0 ? Math.round((medicationCount / medicationTotal) * 100) : null,
      warningSignsFreq,
      // New P2 feature stats
      totalWeeklyAssessments: weeklyAssessments.length,
      avgAsrm: avg(asrmScoresArr),
      avgPhq9: avg(phq9ScoresArr),
      avgFunctioning: avg(fastScoresArr),
      totalLifeChartEvents: lifeChartEvents.length,
      eventTypeCounts,
      // Snapshot / intraday stats
      totalSnapshotDays: entries.filter((e) => e.mode === "AUTO_FROM_SNAPSHOT").length,
      avgSnapshotsPerDay: (() => {
        const snapDays = entries.filter((e) => e.mode === "AUTO_FROM_SNAPSHOT" && (e.snapshotCount ?? 0) > 0);
        return snapDays.length > 0
          ? Math.round((snapDays.reduce((s, e) => s + (e.snapshotCount ?? 0), 0) / snapDays.length) * 10) / 10
          : null;
      })(),
      avgMoodRange: (() => {
        const ranges = entries.filter((e) => e.moodRange != null).map((e) => e.moodRange!);
        return ranges.length > 0 ? Math.round((ranges.reduce((a, b) => a + b, 0) / ranges.length) * 10) / 10 : null;
      })(),
    },
    entries: entries.map((e) => ({
      ...e,
      provenance: e.mode === "AUTO_FROM_SNAPSHOT" ? "snapshots" : "manual",
    })),
    sleepLogs,
    weeklyAssessments: weeklyAssessments.map((w) => ({
      date: w.date,
      asrmTotal: w.asrmTotal,
      phq9Total: w.phq9Total,
      fastAvg: w.fastAvg,
      exerciseDaysPerWeek: w.exerciseDaysPerWeek,
    })),
    lifeChartEvents: lifeChartEvents.map((e) => ({
      date: e.date,
      eventType: e.eventType,
      label: e.label,
    })),
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
