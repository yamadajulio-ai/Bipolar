import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

/**
 * GET — Show Health Connect integration status (session auth).
 * Returns the same data shape as /api/integrations/health-export/status
 * so the frontend can use the same UI for both.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const limited = await checkRateLimit(`hc_status_read:${session.userId}`, 60, 60_000);
  if (limited) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
  const integration = await prisma.integrationKey.findFirst({
    where: { userId: session.userId, service: "health_connect" },
  });

  if (!integration) {
    return NextResponse.json({ configured: false, records: [], healthMetrics: [] });
  }

  const sleepLogs = await prisma.sleepLog.findMany({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
    take: 10,
  });

  const healthMetrics = await prisma.healthMetric.findMany({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({
    configured: true,
    enabled: integration.enabled,
    lastPayload: integration.lastPayloadDebug ?? null,
    records: sleepLogs.map((l) => ({
      date: l.date,
      bedtime: l.bedtime,
      wakeTime: l.wakeTime,
      totalHours: l.totalHours,
      quality: l.quality,
      awakenings: l.awakenings,
      hrv: l.hrv,
      heartRate: l.heartRate,
    })),
    healthMetrics: healthMetrics.map((m) => ({
      date: m.date,
      metric: m.metric,
      value: m.value,
      unit: m.unit,
    })),
  });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "hc_status" } });
    return NextResponse.json({ error: "Erro ao buscar status" }, { status: 500 });
  }
}
