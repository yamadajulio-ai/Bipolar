import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeInsights, formatSleepDuration } from "@/lib/insights/computeInsights";

const TZ = "America/Sao_Paulo";

export async function GET() {
  const session = await getSession();
  const now = new Date();

  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

  const sleepLogs = await prisma.sleepLog.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str }, totalHours: { gte: 1 } },
    orderBy: { date: "asc" },
  });

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str } },
    orderBy: { date: "asc" },
  });

  const rhythms = await prisma.dailyRhythm.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str } },
    orderBy: { date: "asc" },
  });

  const insights = computeInsights(sleepLogs, entries, rhythms, [], now, TZ);

  return NextResponse.json({
    midpoint: insights.sleep.midpoint,
    avgDuration: insights.sleep.avgDuration,
    bedtimeVariance: insights.sleep.bedtimeVariance,
    avgDurationFormatted: insights.sleep.avgDuration !== null
      ? formatSleepDuration(insights.sleep.avgDuration)
      : null,
  });
}
