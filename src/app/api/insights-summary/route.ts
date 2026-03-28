import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { computeInsights, formatSleepDuration } from "@/lib/insights/computeInsights";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const TZ = "America/Sao_Paulo";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`insights_summary_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const now = new Date();

    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

    const sleepLogs = await prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str }, totalHours: { gte: 1 } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        bedtime: true,
        wakeTime: true,
        totalHours: true,
        quality: true,
        awakenings: true,
      },
    });

    const entries = await prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
      select: {
        date: true,
        mood: true,
        sleepHours: true,
        energyLevel: true,
        anxietyLevel: true,
        irritability: true,
        tookMedication: true,
        warningSigns: true,
      },
    });

    const insights = computeInsights(sleepLogs, entries, [], [], now, TZ);

    return NextResponse.json({
      midpoint: insights.sleep.midpoint,
      avgDuration: insights.sleep.avgDuration,
      bedtimeVariance: insights.sleep.bedtimeVariance,
      avgDurationFormatted: insights.sleep.avgDuration !== null
        ? formatSleepDuration(insights.sleep.avgDuration)
        : null,
    }, { headers: { "Cache-Control": "private, no-cache" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "insights_summary" } });
    return NextResponse.json(
      { error: "Erro ao calcular resumo de insights." },
      { status: 500 },
    );
  }
}
