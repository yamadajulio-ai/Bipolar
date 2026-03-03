import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET — Show imported sleep records, health metrics, and integration status.
 * Uses session auth (browser access from integrations page).
 */
export async function GET() {
  const session = await getSession();

  const integration = await prisma.integrationKey.findFirst({
    where: { userId: session.userId, service: "health_auto_export" },
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
}

/**
 * DELETE — Clear all imported sleep records and health metrics (for re-sync).
 */
export async function DELETE() {
  const session = await getSession();

  const deletedSleep = await prisma.sleepLog.deleteMany({
    where: { userId: session.userId },
  });
  const deletedMetrics = await prisma.healthMetric.deleteMany({
    where: { userId: session.userId },
  });

  return NextResponse.json({
    deleted: deletedSleep.count,
    deletedMetrics: deletedMetrics.count,
  });
}
