import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr } from "@/lib/dateUtils";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`sono_tendencias_read:${session.userId}`, 60, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get("days") || "30", 10) || 30, 1), 365);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
      excluded: false,
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      bedtime: true,
      totalHours: true,
      quality: true,
      awakenings: true,
      source: true,
    },
  });

  if (logs.length === 0) {
    return NextResponse.json({
      totalLogs: 0,
      avgHours: 0,
      avgQuality: 0,
      avgAwakenings: 0,
      bedtimeVariance: 0,
      alerts: [],
      logs: [],
    }, {
      headers: { "Cache-Control": "private, no-cache" },
    });
  }

  const totalHours = logs.reduce((sum, l) => sum + l.totalHours, 0);
  const totalQuality = logs.reduce((sum, l) => sum + l.quality, 0);
  const totalAwakenings = logs.reduce((sum, l) => sum + l.awakenings, 0);
  const count = logs.length;

  const avgHours = Math.round((totalHours / count) * 10) / 10;
  const avgQuality = Math.round((totalQuality / count) * 10) / 10;
  const avgAwakenings = Math.round((totalAwakenings / count) * 10) / 10;

  // Calculate bedtime variance (in minutes)
  const bedtimeMinutes = logs.map((l) => {
    const [h, m] = l.bedtime.split(":").map(Number);
    // Normalize: treat times after midnight (0-6) as 24+ for consistency
    const totalMin = h < 6 ? (h + 24) * 60 + m : h * 60 + m;
    return totalMin;
  });
  const avgBedtime = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
  const variance =
    bedtimeMinutes.reduce((sum, bt) => sum + Math.pow(bt - avgBedtime, 2), 0) /
    bedtimeMinutes.length;
  const bedtimeVariance = Math.round(Math.sqrt(variance));

  // Generate alerts
  const alerts: string[] = [];

  if (avgHours < 6) {
    alerts.push("Média de sono abaixo de 6 horas. Sono insuficiente pode desencadear episódios.");
  }
  if (avgHours > 10) {
    alerts.push("Média de sono acima de 10 horas. Excesso de sono pode indicar fase depressiva.");
  }
  if (avgQuality < 2.5) {
    alerts.push("Qualidade do sono consistentemente baixa. Converse com seu profissional de saúde.");
  }
  if (bedtimeVariance > 90) {
    alerts.push("Horário de dormir muito irregular. Tente manter um horário mais consistente.");
  }
  if (avgAwakenings > 3) {
    alerts.push("Muitos despertares durante a noite. Considere revisar sua higiene do sono.");
  }

  return NextResponse.json({
    totalLogs: count,
    avgHours,
    avgQuality,
    avgAwakenings,
    bedtimeVariance,
    alerts,
    logs: logs.map((l) => ({
      date: l.date,
      totalHours: l.totalHours,
      quality: l.quality,
      awakenings: l.awakenings,
      bedtime: l.bedtime,
    })),
  }, {
    headers: { "Cache-Control": "private, no-cache" },
  });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sono_tendencias" } });
    return NextResponse.json({ error: "Erro ao buscar tendências" }, { status: 500 });
  }
}
