import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Parâmetro month inválido (YYYY-MM)" }, { status: 400 });
  }

  const startDate = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const nextMonth = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
  const endDate = `${nextMonth}-01`;

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.userId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: "asc" },
  });

  const sleepLogs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: startDate, lt: endDate },
    },
    orderBy: { date: "asc" },
  });

  const exerciseSessions = await prisma.exerciseSession.findMany({
    where: {
      userId: session.userId,
      completedAt: { gte: new Date(startDate), lt: new Date(endDate) },
    },
  });

  const rhythms = await prisma.dailyRhythm.findMany({
    where: {
      userId: session.userId,
      date: { gte: startDate, lt: endDate },
    },
  });

  // Aggregations
  const moods = entries.map((e) => e.mood);
  const sleeps = entries.map((e) => e.sleepHours);
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

  return NextResponse.json({
    month,
    stats: {
      totalDiaryEntries: entries.length,
      totalSleepLogs: sleepLogs.length,
      totalExercises: exerciseSessions.length,
      totalRhythms: rhythms.length,
      avgMood: avg(moods),
      avgSleep: avg(sleeps),
      avgEnergy: avg(energies),
      avgAnxiety: avg(anxieties),
      avgSleepQuality: avg(sleepLogs.map((s) => s.quality)),
      moodDistribution,
      medicationAdherence: medicationTotal > 0 ? Math.round((medicationCount / medicationTotal) * 100) : null,
      warningSignsFreq,
    },
    entries,
    sleepLogs,
  });
}
