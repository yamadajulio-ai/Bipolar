import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { z } from "zod/v4";

const bodySchema = z.object({
  password: z.string().min(1, "Senha obrigatória").optional(),
});

/**
 * LGPD Art. 18, V — Portabilidade de dados.
 * Exports all user data as a JSON download.
 * Requires step-up auth: password re-confirmation (email users)
 * or recent session check (Google OAuth users).
 */
export async function POST(request: NextRequest) {
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

  // Step-up auth: verify identity before exporting PHI
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, authProvider: true, passwordHash: true, createdAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (user.authProvider === "email") {
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { error: "Confirme sua senha para exportar seus dados.", requiresPassword: true },
        { status: 422 },
      );
    }
    if (!body.password || !user.passwordHash) {
      return NextResponse.json(
        { error: "Confirme sua senha para exportar seus dados.", requiresPassword: true },
        { status: 422 },
      );
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
    }
  } else {
    // Google OAuth users: require recent authentication (< 5 min)
    const REAUTH_WINDOW = 5 * 60 * 1000;
    if (!session.lastActive || Date.now() - session.lastActive > REAUTH_WINDOW) {
      return NextResponse.json(
        { error: "Faça login novamente antes de exportar seus dados.", requiresReauth: true },
        { status: 403 },
      );
    }
  }

  try {
    const [
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
      user: { id: user.id, email: user.email, name: user.name, authProvider: user.authProvider, createdAt: user.createdAt },
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
        "Cache-Control": "no-store, private, max-age=0",
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "data-export" } });
    return NextResponse.json({ error: "Erro ao exportar dados." }, { status: 500 });
  }
}
