import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { computeInsights, type PlannerBlockInput } from "@/lib/insights/computeInsights";
import { generateNarrative, computeSourceFingerprint, prepareNarrativeInput, PROMPT_VERSION, SCHEMA_VERSION, ANALYTICS_VERSION, GUARDRAIL_VERSION } from "@/lib/ai/generateNarrative";
import type { NarrativeExtraData, AssessmentSnapshot, LifeEventSnapshot, CognitiveSnapshot } from "@/lib/ai/narrative-types";

const TZ = "America/Sao_Paulo";

export const maxDuration = 30;

// DELETE — Revoke/delete a specific narrative (LGPD right of erasure).
// Deletes the narrative and its feedback. Cascading via Prisma relation.
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const narrativeId = url.searchParams.get("id");

  if (!narrativeId) {
    return NextResponse.json({ error: "ID da narrativa é obrigatório" }, { status: 400 });
  }

  // Verify ownership before deletion
  const narrative = await prisma.narrative.findFirst({
    where: { id: narrativeId, userId: session.userId },
    select: { id: true },
  });

  if (!narrative) {
    return NextResponse.json({ error: "Narrativa não encontrada" }, { status: 404 });
  }

  // Delete narrative (feedbacks cascade via onDelete: Cascade in schema)
  await prisma.narrative.delete({ where: { id: narrativeId } });

  return NextResponse.json({ success: true });
}

function spDate(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

// GET — Return latest cached narrative (if available).
// Contract: returns the latest SAFE narrative (guardrailPassed=true).
// If the most recent attempt failed guardrails, signals this via latestAttemptFailed
// so the frontend can inform the user without exposing unsafe content.
export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Fetch latest attempt (any status) to detect if the most recent one failed
  const [latestAttempt, latestSafe] = await Promise.all([
    prisma.narrative.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, guardrailPassed: true, status: true, createdAt: true },
    }),
    prisma.narrative.findFirst({
      where: { userId: session.userId, status: "completed", guardrailPassed: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, outputJson: true, createdAt: true, sourceFingerprint: true, shareWithProfessional: true },
    }),
  ]);

  // No narrative at all
  if (!latestSafe) {
    return NextResponse.json({
      cached: false,
      // If there was an attempt but it failed, let the frontend know
      latestAttemptFailed: latestAttempt ? !latestAttempt.guardrailPassed : false,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  // Extract evidence map from stored output (embedded at save time)
  const outputJson = latestSafe.outputJson as Record<string, unknown>;
  const storedEvidenceMap = outputJson?._evidenceMap ?? {};

  // Signal if the most recent attempt is NOT the one being returned (guardrail failure)
  const latestAttemptFailed = latestAttempt?.id !== latestSafe.id && !latestAttempt?.guardrailPassed;

  return NextResponse.json({
    cached: true,
    narrativeId: latestSafe.id,
    narrative: latestSafe.outputJson,
    evidenceMap: storedEvidenceMap,
    sourceFingerprint: latestSafe.sourceFingerprint,
    shareWithProfessional: latestSafe.shareWithProfessional,
    createdAt: latestSafe.createdAt.toISOString(),
    latestAttemptFailed,
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST — Generate AI narrative V2
export async function POST(request: NextRequest) {
  // Kill switch: disable AI narrative generation entirely
  if (process.env.KILL_AI_NARRATIVE === "true") {
    return NextResponse.json({ error: "Funcionalidade temporariamente desabilitada" }, { status: 503 });
  }

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

    // Build evidence map for explainability chips
    const evidenceMap: Record<string, { text: string; domain: string; kind: string; confidence: string }> = {};
    for (const packet of Object.values(input.sections)) {
      for (const ev of packet.evidence) {
        evidenceMap[ev.id] = { text: ev.text, domain: ev.domain, kind: ev.kind, confidence: ev.confidence };
      }
    }

    if (cachedNarrative) {
      return NextResponse.json({
        cached: true,
        narrativeId: cachedNarrative.id,
        narrative: cachedNarrative.outputJson,
        evidenceMap,
        shareWithProfessional: cachedNarrative.shareWithProfessional,
        createdAt: cachedNarrative.createdAt.toISOString(),
      }, { headers: { "Cache-Control": "no-store" } });
    }

    // Check OPENAI_API_KEY only when LLM path is needed
    const hasEnoughData = sleepLogs30.length >= 7 && entries30.length >= 3;
    const willCallLlm = insights.risk?.level !== "atencao_alta" && hasEnoughData;
    if (!process.env.OPENAI_API_KEY && willCallLlm) {
      return NextResponse.json({ error: "AI não configurada" }, { status: 503 });
    }

    // Consent gate: block LLM path entirely without valid consent.
    // For deterministic templates (high-risk, insufficient data), no consent needed.
    if (willCallLlm) {
      const existingConsent = await prisma.consent.findFirst({
        where: { userId, scope: "ai_narrative", revokedAt: null },
        select: { id: true },
      });
      if (!existingConsent) {
        // Require explicit consent flag from frontend (checkbox + disclosure)
        let body: { consent?: boolean } = {};
        try { body = await request.json(); } catch { /* no body */ }
        if (!body.consent) {
          return NextResponse.json(
            { error: "Consentimento necessário para gerar resumo com IA." },
            { status: 403 },
          );
        }
        // First-time grant: record consent with audit trail
        await prisma.consent.create({ data: { userId, scope: "ai_narrative" } });
      }
    }

    // Get previous narrative ID for chain
    const previousNarrative = await prisma.narrative.findFirst({
      where: { userId }, orderBy: { createdAt: "desc" }, select: { id: true },
    });

    // Generate narrative V2
    const { narrative, persistence } = await generateNarrative(insights, extraData, now, TZ);

    // Persist narrative to DB
    const periodStart = spDate(d30);
    const periodEnd = spDate(now);

    const saved = await prisma.narrative.create({
      data: {
        userId,
        periodStart, periodEnd,
        status: persistence.guardrailPassed ? "completed" : "fallback",
        riskLevel: persistence.sourceFingerprint ? input.riskLevel : "low",
        dataQuality: (insights.sleep.recordCount < 7 || insights.mood.recordCount < 3) ? "insufficient" : "ok",
        model: persistence.model,
        reasoningEffort: persistence.reasoningEffort,
        promptVersion: persistence.promptVersion,
        schemaVersion: persistence.schemaVersion,
        analyticsVersion: persistence.analyticsVersion,
        guardrailVersion: persistence.guardrailVersion,
        sourceFingerprint: persistence.sourceFingerprint,
        outputJson: JSON.parse(JSON.stringify({ ...narrative, _evidenceMap: evidenceMap })),
        shareWithProfessional: narrative.actions.shareWithProfessional,
        bypassLlm: persistence.bypassLlm,
        bypassReason: persistence.bypassReason,
        llmAttempted: persistence.llmAttempted,
        guardrailPassed: persistence.guardrailPassed,
        guardrailViolations: persistence.guardrailViolations,
        inputTokens: persistence.inputTokens,
        cachedInputTokens: persistence.cachedInputTokens,
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
      evidenceMap,
      shareWithProfessional: narrative.actions.shareWithProfessional,
      createdAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "insights-narrative-v2" } });
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    const errStack = err instanceof Error ? err.stack?.slice(0, 500) : undefined;
    console.error(JSON.stringify({
      event: "insights_narrative_v2_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: errMsg.slice(0, 200),
      stack: errStack,
    }));
    return NextResponse.json({ error: `Erro ao gerar resumo: ${errMsg.slice(0, 100)}` }, { status: 500 });
  }
}
