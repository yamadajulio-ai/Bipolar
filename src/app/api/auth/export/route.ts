import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

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

  // Rate limit: 5 exports per hour per user
  const allowed = await checkRateLimit(`export:${userId}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas exportações. Tente novamente mais tarde." },
      { status: 429 }
    );
  }

  try {
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
      feedbacks,
      contextualFeedbacks,
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
      prisma.feedback.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
      prisma.contextualFeedback.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
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
      feedbacks,
      contextualFeedbacks,
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="suporte-bipolar-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "data-export" } });
    return NextResponse.json({ error: "Erro ao exportar dados." }, { status: 500 });
  }
}
