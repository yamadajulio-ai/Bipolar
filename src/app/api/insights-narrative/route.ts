import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { computeInsights, type PlannerBlockInput } from "@/lib/insights/computeInsights";
import { generateNarrative } from "@/lib/ai/generateNarrative";

const TZ = "America/Sao_Paulo";

export const maxDuration = 30;

/** Compute a YYYY-MM-DD date string in São Paulo timezone. */
function spDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// POST — Generate AI narrative (mutating: sends data to OpenAI, consumes quota)
export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI não configurada" }, { status: 503 });
  }

  // Rate limit: 10 AI narrative requests per hour per user
  const allowed = await checkRateLimit(`narrative:${session.userId}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Você já gerou muitos resumos recentemente. Tente novamente em breve." },
      { status: 429 },
    );
  }

  try {
    const userId = session.userId;
    const now = new Date();

    // Use São Paulo timezone for date boundaries (avoids off-by-one near midnight)
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30str = spDate(d30);

    const d90 = new Date(now);
    d90.setDate(d90.getDate() - 90);
    const d90str = spDate(d90);

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
      TZ,
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
      { error: "Erro ao gerar resumo" },
      { status: 500 },
    );
  }
}
