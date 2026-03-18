import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { computeInsights, type PlannerBlockInput } from "@/lib/insights/computeInsights";
import { generateNarrative } from "@/lib/ai/generateNarrative";

const TZ = "America/Sao_Paulo";

export const maxDuration = 30;

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI não configurada" }, { status: 503 });
  }

  // Rate limit: 10 AI narrative requests per hour per user
  const allowed = await checkRateLimit(`narrative:${session.userId}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Você já gerou muitas narrativas recentemente. Tente novamente em breve." },
      { status: 429 },
    );
  }

  try {
    const userId = session.userId;
    const now = new Date();
    const tz = "America/Sao_Paulo";

    // 30-day window for primary insights
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30str = d30.toISOString().slice(0, 10);

    // 90-day window for P2 features
    const d90 = new Date(now);
    d90.setDate(d90.getDate() - 90);
    const d90str = d90.toISOString().slice(0, 10);

    // Fetch all data in parallel
    const [sleepLogs30, entries30, rhythms30, plannerBlocks, sleepLogs90, entries90, financialTxs] =
      await Promise.all([
        prisma.sleepLog.findMany({
          where: { userId, date: { gte: d30str } },
          orderBy: { date: "asc" },
        }),
        prisma.diaryEntry.findMany({
          where: { userId, date: { gte: d30str } },
          orderBy: { date: "asc" },
        }),
        prisma.dailyRhythm.findMany({
          where: { userId, date: { gte: d30str } },
          orderBy: { date: "asc" },
        }),
        prisma.plannerBlock.findMany({
          where: { userId, startAt: { gte: d30 } },
          orderBy: { startAt: "asc" },
        }),
        prisma.sleepLog.findMany({
          where: { userId, date: { gte: d90str } },
          orderBy: { date: "asc" },
        }),
        prisma.diaryEntry.findMany({
          where: { userId, date: { gte: d90str } },
          orderBy: { date: "asc" },
        }),
        prisma.financialTransaction.findMany({
          where: { userId, date: { gte: d30str } },
          orderBy: { date: "asc" },
        }),
      ]);

    // Transform planner blocks to expected input format
    const plannerBlockInputs: PlannerBlockInput[] = plannerBlocks.map((b) => {
      const d = new Date(b.startAt);
      return {
        date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
        timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
        category: b.category,
      };
    });

    // Compute insights
    const insights = computeInsights(
      sleepLogs30,
      entries30,
      rhythms30,
      plannerBlockInputs,
      now,
      tz,
      entries90,
      sleepLogs90,
      financialTxs,
    );

    // Generate narrative
    const narrative = await generateNarrative(insights);

    return NextResponse.json(narrative, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "insights-narrative" } });
    console.error("Insights narrative error:", err);
    return NextResponse.json(
      { error: "Erro ao gerar narrativa" },
      { status: 500 },
    );
  }
}
