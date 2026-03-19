import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { computeInsights, type PlannerBlockInput } from "@/lib/insights/computeInsights";
import { generateNarrative, computeSourceFingerprint, prepareNarrativeInput, PROMPT_VERSION, SCHEMA_VERSION } from "@/lib/ai/generateNarrative";
import type { NarrativeExtraData, AssessmentSnapshot, LifeEventSnapshot, CognitiveSnapshot } from "@/lib/ai/narrative-types";

const TZ = "America/Sao_Paulo";

export const maxDuration = 30;

function spDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// GET — Return latest cached narrative (if available)
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const latest = await prisma.narrative.findFirst({
    where: { userId: session.userId, status: "completed" },
    orderBy: { createdAt: "desc" },
    select: { id: true, outputJson: true, createdAt: true, sourceFingerprint: true, shareWithProfessional: true },
  });

  if (!latest) {
    return NextResponse.json({ cached: false }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({
    cached: true,
    narrativeId: latest.id,
    narrative: latest.outputJson,
    sourceFingerprint: latest.sourceFingerprint,
    shareWithProfessional: latest.shareWithProfessional,
    createdAt: latest.createdAt.toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST — Generate AI narrative V2
export async function POST(_request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

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

    const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
    const d30str = spDate(d30);
    const d90 = new Date(now); d90.setDate(d90.getDate() - 90);
    const d90str = spDate(d90);

    // Minimal select per model — LGPD data minimization
    const sleepSelect = { date: true, bedtime: true, wakeTime: true, totalHours: true, quality: true, awakenings: true } as const;
    const diarySelect = { date: true, mood: true, sleepHours: true, energyLevel: true, anxietyLevel: true, irritability: true, tookMedication: true, warningSigns: true } as const;
    const rhythmSelect = { date: true, wakeTime: true, firstContact: true, mainActivityStart: true, dinnerTime: true, bedtime: true } as const;
    const financialSelect = { date: true, amount: true } as const;

    // Fetch ALL data in parallel (including new sources: assessments, life events, cognitive)
    const [
      sleepLogs30, entries30, rhythms30, plannerBlocks,
      sleepLogs90, entries90, financialTxs,
      assessments, lifeEvents, cognitiveTests,
    ] = await Promise.all([
      prisma.sleepLog.findMany({ where: { userId, date: { gte: d30str } }, select: sleepSelect, orderBy: { date: "asc" }, take: 500 }),
      prisma.diaryEntry.findMany({ where: { userId, date: { gte: d30str } }, select: diarySelect, orderBy: { date: "asc" }, take: 500 }),
      prisma.dailyRhythm.findMany({ where: { userId, date: { gte: d30str } }, select: rhythmSelect, orderBy: { date: "asc" }, take: 500 }),
      prisma.plannerBlock.findMany({ where: { userId, startAt: { gte: d30 } }, select: { startAt: true, category: true }, orderBy: { startAt: "asc" }, take: 1000 }),
      prisma.sleepLog.findMany({ where: { userId, date: { gte: d90str } }, select: sleepSelect, orderBy: { date: "asc" }, take: 500 }),
      prisma.diaryEntry.findMany({ where: { userId, date: { gte: d90str } }, select: diarySelect, orderBy: { date: "asc" }, take: 500 }),
      prisma.financialTransaction.findMany({ where: { userId, date: { gte: d30str } }, select: financialSelect, orderBy: { date: "asc" }, take: 1000 }),
      // New: last 2 weekly assessments (current + previous for delta)
      prisma.weeklyAssessment.findMany({
        where: { userId, date: { gte: d30str } },
        select: { date: true, asrmTotal: true, phq9Total: true, phq9Item9: true, fastAvg: true },
        orderBy: { date: "desc" }, take: 2,
      }),
      // New: life events last 30d (only category + date, no label/notes — LGPD + safety)
      prisma.lifeChartEvent.findMany({
        where: { userId, date: { gte: d30str } },
        select: { date: true, eventType: true },
        orderBy: { date: "asc" }, take: 50,
      }),
      // New: cognitive tests last 30d
      prisma.cognitiveTest.findMany({
        where: { userId, createdAt: { gte: d30 } },
        select: { reactionTimeMs: true, digitSpan: true, createdAt: true },
        orderBy: { createdAt: "asc" }, take: 30,
      }),
    ]);

    // Transform planner blocks
    const plannerBlockInputs: PlannerBlockInput[] = plannerBlocks.map((b) => {
      const d = new Date(b.startAt);
      return {
        date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
        timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
        category: b.category,
      };
    });

    // Compute insights (deterministic)
    const insights = computeInsights(
      sleepLogs30, entries30, rhythms30, plannerBlockInputs,
      now, TZ, entries90, sleepLogs90, financialTxs,
    );

    // Prepare extra data for narrative V2
    const extraData: NarrativeExtraData = {
      assessments: assessments.map((a): AssessmentSnapshot => ({
        date: a.date, asrmTotal: a.asrmTotal, phq9Total: a.phq9Total,
        phq9Item9: a.phq9Item9, fastAvg: a.fastAvg,
      })),
      lifeEvents: lifeEvents.map((e): LifeEventSnapshot => ({
        date: e.date, eventType: e.eventType,
      })),
      cognitiveTests: cognitiveTests.map((t): CognitiveSnapshot => ({
        reactionTimeMs: t.reactionTimeMs, digitSpan: t.digitSpan, createdAt: t.createdAt,
      })),
    };

    // Compute fingerprint to check for cached narrative
    const input = prepareNarrativeInput(insights, extraData, now, TZ);
    const fingerprint = computeSourceFingerprint(input);

    // Check cache: if fingerprint matches latest narrative, return it
    const cachedNarrative = await prisma.narrative.findFirst({
      where: { userId, sourceFingerprint: fingerprint, status: "completed", guardrailPassed: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, outputJson: true, createdAt: true, shareWithProfessional: true },
    });

    if (cachedNarrative) {
      return NextResponse.json({
        cached: true,
        narrativeId: cachedNarrative.id,
        narrative: cachedNarrative.outputJson,
        shareWithProfessional: cachedNarrative.shareWithProfessional,
        createdAt: cachedNarrative.createdAt.toISOString(),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    // Check OPENAI_API_KEY only when LLM path is needed
    if (!process.env.OPENAI_API_KEY) {
      const risk = insights.risk;
      if (risk?.level !== "atencao_alta" && sleepLogs30.length >= 7) {
        return NextResponse.json({ error: "AI não configurada" }, { status: 503 });
      }
    }

    // Get previous narrative ID for chain
    const previousNarrative = await prisma.narrative.findFirst({
      where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true },
    });

    // Generate narrative V2
    const { narrative, persistence } = await generateNarrative(insights, extraData, now, TZ);

    // Record AI consent only when LLM was actually used (not for deterministic templates)
    if (narrative.source === "llm") {
      const existingConsent = await prisma.consent.findFirst({
        where: { userId, scope: "ai_narrative", revokedAt: null },
        select: { id: true },
      });
      if (!existingConsent) {
        await prisma.consent.create({ data: { userId, scope: "ai_narrative" } });
      }
    }

    // Persist narrative to DB
    const periodStart = spDate(d30);
    const periodEnd = spDate(now);

    const saved = await prisma.narrative.create({
      data: {
        userId,
        periodStart, periodEnd,
        status: persistence.guardrailPassed ? "completed" : "fallback",
        riskLevel: persistence.sourceFingerprint ? input.riskLevel : "low",
        dataQuality: insights.sleep.recordCount < 7 ? "insufficient" : "ok",
        model: persistence.model,
        reasoningEffort: persistence.reasoningEffort,
        promptVersion: persistence.promptVersion,
        schemaVersion: persistence.schemaVersion,
        sourceFingerprint: persistence.sourceFingerprint,
        outputJson: JSON.parse(JSON.stringify(narrative)),
        shareWithProfessional: narrative.actions.shareWithProfessional,
        bypassLlm: persistence.bypassLlm,
        bypassReason: persistence.bypassReason,
        guardrailPassed: persistence.guardrailPassed,
        guardrailViolations: persistence.guardrailViolations,
        inputTokens: persistence.inputTokens,
        outputTokens: persistence.outputTokens,
        reasoningTokens: persistence.reasoningTokens,
        latencyMs: persistence.latencyMs,
        previousNarrativeId: previousNarrative?.id ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({
      cached: false,
      narrativeId: saved.id,
      narrative,
      shareWithProfessional: narrative.actions.shareWithProfessional,
      createdAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "insights-narrative-v2" } });
    console.error("Insights narrative V2 error:", err);
    return NextResponse.json({ error: "Erro ao gerar resumo" }, { status: 500 });
  }
}
