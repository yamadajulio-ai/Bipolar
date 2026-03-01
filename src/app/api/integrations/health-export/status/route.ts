import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET — Show imported sleep records and integration status.
 * Uses session auth (browser access from integrations page).
 */
export async function GET() {
  const session = await getSession();

  const integration = await prisma.integrationKey.findFirst({
    where: { userId: session.userId, service: "health_auto_export" },
  });

  if (!integration) {
    return NextResponse.json({ configured: false, records: [] });
  }

  const sleepLogs = await prisma.sleepLog.findMany({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
    take: 10,
  });

  return NextResponse.json({
    configured: true,
    enabled: integration.enabled,
    records: sleepLogs.map((l) => ({
      date: l.date,
      bedtime: l.bedtime,
      wakeTime: l.wakeTime,
      totalHours: l.totalHours,
      quality: l.quality,
      awakenings: l.awakenings,
    })),
  });
}

/**
 * DELETE — Clear all imported sleep records (for re-sync after fixing config).
 */
export async function DELETE() {
  const session = await getSession();

  const deleted = await prisma.sleepLog.deleteMany({
    where: { userId: session.userId },
  });

  return NextResponse.json({ deleted: deleted.count });
}
