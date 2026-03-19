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

    // Record AI narrative consent on first use (informed consent via UI disclosure).
    // Upsert: only creates if no active consent exists — idempotent on retries.
    const existingConsent = await prisma.consent.findFirst({
      where: { userId, scope: "ai_narrative", revokedAt: null },
      select: { id: true },
    });
    if (!existingConsent) {
      await prisma.consent.create({
        data: { userId, scope: "ai_narrative" },
      });
    }

    // Use São Paulo timezone for date boundaries (avoids off-by-one near midnight)
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d30str = spDate(d30);

    const d90 = new Date(now);
    d90.setDate(d90.getDate() - 90);
    const d90str = spDate(d90);

    // Minimal select per model — LGPD data minimization (only fields used by computeInsights)
    const sleepSelect = { date: true, bedtime: true, wakeTime: true, totalHours: true, quality: true, awakenings: true } as const;
    const diarySelect = { date: true, mood: true, sleepHours: true, energyLevel: true, anxietyLevel: true, irritability: true, tookMedication: true, warningSigns: true } as const;
    const rhythmSelect = { date: true, wakeTime: true, firstContact: true, mainActivityStart: true, dinnerTime: true, bedtime: true } as const;
    const financialSelect = { date: true, amount: true } as const;

    // Fetch all data in parallel
    const [sleepLogs30, entries30, rhythms30, plannerBlocks, sleepLogs90, entries90, financialTxs] =
      await Promise.all([
        prisma.sleepLog.findMany({
          where: { userId, date: { gte: d30str } },
          select: sleepSelect,
          orderBy: { date: "asc" },
          take: 500,
        }),
        prisma.diaryEntry.findMany({
          where: { userId, date: { gte: d30str } },
          select: diarySelect,
          orderBy: { date: "asc" },
          take: 500,
        }),
        prisma.dailyRhythm.findMany({
          where: { userId, date: { gte: d30str } },
          select: rhythmSelect,
          orderBy: { date: "asc" },
          take: 500,
        }),
        prisma.plannerBlock.findMany({
          where: { userId, startAt: { gte: d30 } },
          select: { startAt: true, category: true },
          orderBy: { startAt: "asc" },
          take: 1000,
        }),
        prisma.sleepLog.findMany({
          where: { userId, date: { gte: d90str } },
          select: sleepSelect,
          orderBy: { date: "asc" },
          take: 500,
        }),
        prisma.diaryEntry.findMany({
          where: { userId, date: { gte: d90str } },
          select: diarySelect,
          orderBy: { date: "asc" },
          take: 500,
        }),
        prisma.financialTransaction.findMany({
          where: { userId, date: { gte: d30str } },
          select: financialSelect,
          orderBy: { date: "asc" },
          take: 1000,
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

    // Compute insights (deterministic — no AI needed yet)
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

    // Check OPENAI_API_KEY only when LLM path is needed.
    // High-risk and insufficient-data bypass LLM inside generateNarrative,
    // so those paths work without an API key.
    if (!process.env.OPENAI_API_KEY) {
      const risk = insights.risk;
      const sleepCount = sleepLogs30.length;
      // Only block if we'd actually need the LLM
      if (risk?.level !== "atencao_alta" && sleepCount >= 7) {
        return NextResponse.json({ error: "AI não configurada" }, { status: 503 });
      }
    }

    // Generate narrative (may bypass LLM for high-risk/insufficient data)
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
