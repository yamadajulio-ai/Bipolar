import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * LGPD Art. 18, V — Portabilidade de dados.
 * Exports all user data as a JSON download.
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const userId = session.userId;

  const [
    user,
    diaryEntries,
    sleepLogs,
    dailyRhythms,
    plannerBlocks,
    exerciseSessions,
    courseProgress,
    crisisPlan,
    reminderSettings,
    financialTransactions,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, authProvider: true, createdAt: true },
    }),
    prisma.diaryEntry.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.dailyRhythm.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.plannerBlock.findMany({
      where: { userId },
      orderBy: { startAt: "desc" },
      include: { recurrence: true, exceptions: true },
    }),
    prisma.exerciseSession.findMany({ where: { userId }, orderBy: { completedAt: "desc" } }),
    prisma.courseProgress.findMany({ where: { userId }, orderBy: { completedAt: "desc" } }),
    prisma.crisisPlan.findUnique({ where: { userId } }),
    prisma.reminderSettings.findUnique({ where: { userId } }),
    prisma.financialTransaction.findMany({ where: { userId }, orderBy: { date: "desc" } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    lgpdNotice: "Exportação de dados conforme LGPD Art. 18, V — Portabilidade de dados.",
    user,
    diaryEntries,
    sleepLogs,
    dailyRhythms,
    plannerBlocks,
    exerciseSessions,
    courseProgress,
    crisisPlan,
    reminderSettings,
    financialTransactions,
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rede-bipolar-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
