/**
 * Risk v2 — Comprehensive test suite
 *
 * Covers all 3 rails (safety, syndrome, prodrome), state machine hysteresis,
 * actions builder, derive-features, and clinical monotonicity invariants.
 *
 * 80+ deterministic test cases — no Date.now(), all dates explicit.
 */

import { describe, it, expect } from "vitest";
import { evaluateSafetyRail } from "./rails/safety";
import { evaluateSyndromeRail } from "./rails/syndrome";
import { evaluateProdromeRail } from "./rails/prodrome";
import { applyHysteresis, type AlertEpisodeState } from "./state-machine";
import { buildActions } from "./actions";
import { deriveFeatures, type DeriveFeaturesInput } from "./derive-features";
import type {
  DerivedFeatures,
  AsqResult,
  BssaResult,
  RailResult,
  AlertLayer,
  CoverageFlags,
  DiaryEntryInput,
  SleepLogInput,
  FinancialTxInput,
  WeeklyAssessmentInput,
} from "./types";
import { maxLayer } from "./types";

// ── Factories ───────────────────────────────────────────────────────

function makeCoverage(overrides: Partial<CoverageFlags> = {}): CoverageFlags {
  return {
    sleepLowConfidence: false,
    spendLowConfidence: false,
    scalesStale: false,
    entriesLast7d: 5,
    sleepLast7d: 5,
    ...overrides,
  };
}

function makeFeatures(overrides: Partial<DerivedFeatures> = {}): DerivedFeatures {
  return {
    sleepDropMajor: false,
    shortSleepStreak: false,
    bedtimeDrift: false,
    lowMoodRecent: false,
    highEnergyRecent: false,
    highAnxietyRecent: false,
    highIrritabilityRecent: false,
    maniaWarningCluster: false,
    depressionWarningCluster: false,
    medNonAdherenceMajor: false,
    spendingCandidate: false,
    spendingMateriality: false,
    sameDayActivationCorroborator: false,
    latestAsrmTotal: null,
    latestPhq9Total: null,
    latestPhq9Item9: null,
    scalesFresh: true,
    sameAssessmentWindow: true,
    todayHasSuicidalWarningSign: false,
    safetyScreenRequired: false,
    safetyScreenCompleted: false,
    latestAsq: null,
    latestBssa: null,
    mixedCore: false,
    mixedOrange: false,
    mixedYellow: false,
    maniaOrange: false,
    maniaYellow: false,
    depressionOrange: false,
    depressionYellow: false,
    severeManiaAcute: false,
    prodromeMajorCount: 0,
    prodromeMinorCount: 0,
    prodromeOrange: false,
    prodromeYellow: false,
    activationCorroborators: 0,
    distressCorroborators: 0,
    coverage: makeCoverage(),
    ...overrides,
  };
}

function makeAsq(overrides: Partial<AsqResult> = {}): AsqResult {
  return {
    q1: false,
    q2: false,
    q3: false,
    q4: false,
    q5CurrentThoughtsNow: undefined,
    ...overrides,
  };
}

function makeBssa(overrides: Partial<BssaResult> = {}): BssaResult {
  return {
    thoughtRecency: ">30_days",
    thoughtFrequency: "once",
    hasPlan: false,
    planIsDetailed: false,
    hasAccessToMeans: false,
    pastAttempt: "never",
    preparatoryBehavior: "never",
    canStaySafe: "yes",
    ...overrides,
  };
}

function makeRailResult(overrides: Partial<RailResult> = {}): RailResult {
  return {
    layer: "CLEAR",
    reasons: [],
    confidence: "high",
    ...overrides,
  };
}

function makeEpisode(overrides: Partial<AlertEpisodeState> = {}): AlertEpisodeState {
  return {
    layer: "CLEAR",
    lastTriggeredAt: new Date("2026-03-20T10:00:00Z"),
    minHoldUntil: null,
    modalCooldownUntil: null,
    resolvedAt: null,
    ...overrides,
  };
}

const NOW = new Date("2026-03-23T15:00:00Z");

// ═══════════════════════════════════════════════════════════════════
// 1. SAFETY RAIL TRUTH TABLE
// ═══════════════════════════════════════════════════════════════════

describe("Safety Rail", () => {
  // ── RED triggers ──────────────────────────────────────────────

  it("ASQ acute positive → RED", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q1: true, q5CurrentThoughtsNow: true }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("ideacao_suicida_aguda");
    expect(result.confidence).toBe("high");
  });

  it("ASQ q3 + q5 active → RED (acute positive via q3)", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q3: true, q5CurrentThoughtsNow: true }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("RED");
  });

  it("ASQ q4 + q5 active → RED (acute positive via q4)", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q4: true, q5CurrentThoughtsNow: true }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("RED");
  });

  it("BSSA canStaySafe='no' → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ canStaySafe: "no" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("nao_consegue_se_manter_seguro");
  });

  it("BSSA thoughtRecency='now' → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ thoughtRecency: "now" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("pensamentos_suicidas_agora");
  });

  it("BSSA detailed plan + means → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ hasPlan: true, planIsDetailed: true, hasAccessToMeans: true }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("plano_detalhado_com_acesso_a_meios");
  });

  it("BSSA plan without all 3 conditions does NOT trigger RED for detailed plan", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ hasPlan: true, planIsDetailed: true, hasAccessToMeans: false }),
    });
    const result = evaluateSafetyRail(f);
    // hasPlan is true so it falls to ORANGE, not RED for this specific reason
    expect(result.layer).not.toBe("RED");
  });

  it("BSSA recent attempt <3 months → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: "<3_months" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("tentativa_recente");
  });

  it("BSSA recent attempt <7 days → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: "<7_days" }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("RED");
  });

  it("BSSA preparatory behavior <3 months → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ preparatoryBehavior: "<3_months" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("comportamento_preparatorio_recente");
  });

  it("BSSA preparatory behavior <7 days → RED", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ preparatoryBehavior: "<7_days" }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("RED");
  });

  // ── ORANGE triggers ───────────────────────────────────────────

  it("Safety screen pending → ORANGE", () => {
    const f = makeFeatures({
      safetyScreenRequired: true,
      safetyScreenCompleted: false,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("triagem_seguranca_pendente");
    expect(result.pending).toBe(true);
  });

  it("ASQ positive (not acute) → ORANGE", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q1: true, q5CurrentThoughtsNow: false }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("asq_positivo");
  });

  it("ASQ q2 positive alone → ORANGE", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q2: true }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  it("BSSA plan without detailed/means → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ hasPlan: true, planIsDetailed: false }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("plano_suicida_presente");
  });

  it("BSSA unsure safety → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ canStaySafe: "unsure" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("incerto_sobre_seguranca");
  });

  it("BSSA past attempt 3-12 months → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: "3_12_months" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("tentativa_ultimos_12_meses");
  });

  it("BSSA preparatory behavior 3-12 months → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ preparatoryBehavior: "3_12_months" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("preparacao_ultimos_12_meses");
  });

  it("BSSA thought recency 'today' → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ thoughtRecency: "today" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("ideacao_recente");
  });

  it("BSSA thought recency '2_7_days' → ORANGE", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ thoughtRecency: "2_7_days" }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  it("PHQ-9 item 9 ≥ 1 without screen → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 1,
      safetyScreenCompleted: false,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("phq9_item9_positivo_sem_triagem");
    expect(result.pending).toBe(true);
  });

  it("PHQ-9 item 9 = 2 without screen → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: false,
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  it("PHQ-9 item 9 = 3 with completed screen → ORANGE (frequent)", () => {
    const f = makeFeatures({
      latestPhq9Item9: 3,
      safetyScreenCompleted: true,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("phq9_item9_frequente");
  });

  it("PHQ-9 item 9 = 2 with modifier (mixedOrange) → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: true,
      mixedOrange: true,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("phq9_item9_moderado_com_modificador");
  });

  it("PHQ-9 item 9 = 2 with modifier (depressionOrange) → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: true,
      depressionOrange: true,
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  it("PHQ-9 item 9 = 2 with modifier (BSSA daily thoughts) → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: true,
      latestBssa: makeBssa({ thoughtFrequency: "daily" }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  it("PHQ-9 item 9 = 2 with modifier (BSSA past attempt not never) → ORANGE", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: true,
      latestBssa: makeBssa({ pastAttempt: ">1_year" }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("ORANGE");
  });

  // ── YELLOW triggers ───────────────────────────────────────────

  it("PHQ-9 item 9 = 1 with completed screen (no modifier) → YELLOW", () => {
    const f = makeFeatures({
      latestPhq9Item9: 1,
      safetyScreenCompleted: true,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("phq9_item9_positivo_triagem_ok");
  });

  it("PHQ-9 item 9 = 2 without modifier and with screen → YELLOW", () => {
    const f = makeFeatures({
      latestPhq9Item9: 2,
      safetyScreenCompleted: true,
      // No modifiers set
    });
    // moderateFrequency (>=2) is true, but no hasRiskModifier → falls through to YELLOW
    // Actually let's check: moderateFrequency && hasRiskModifier → ORANGE
    // hasRiskModifier = mixedOrange || depressionOrange || bssa conditions
    // None set → hasRiskModifier = false → falls to YELLOW
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("YELLOW");
  });

  it("BSSA past attempt >1 year → YELLOW", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: ">1_year" }),
    });
    // pastAttempt >1_year does not trigger ORANGE (only 3_12_months does)
    // But wait — BSSA thoughtRecency is >30_days which does NOT trigger ORANGE
    // hasPlan is false, canStaySafe is yes, no ORANGE BSSA triggers
    // Falls through to YELLOW for >1_year
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("historico_tentativa_remota");
  });

  it("Today has suicidal warning sign with completed screen → YELLOW", () => {
    const f = makeFeatures({
      todayHasSuicidalWarningSign: true,
      safetyScreenCompleted: true,
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("sinal_suicida_com_triagem_ok");
  });

  // ── CLEAR ─────────────────────────────────────────────────────

  it("No triggers → CLEAR", () => {
    const f = makeFeatures();
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("CLEAR");
    expect(result.reasons).toHaveLength(0);
  });

  it("BSSA all benign → CLEAR", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({
        thoughtRecency: ">30_days",
        canStaySafe: "yes",
        hasPlan: false,
        pastAttempt: "never",
        preparatoryBehavior: "never",
      }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("CLEAR");
  });

  it("ASQ all negative → CLEAR", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q1: false, q2: false, q3: false, q4: false }),
    });
    expect(evaluateSafetyRail(f).layer).toBe("CLEAR");
  });

  // ── Priority: RED checked before ORANGE ───────────────────────

  it("ASQ acute + pending screen → RED wins over ORANGE", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q1: true, q5CurrentThoughtsNow: true }),
      safetyScreenRequired: true,
      safetyScreenCompleted: false,
    });
    expect(evaluateSafetyRail(f).layer).toBe("RED");
  });

  it("BSSA canStaySafe=no + plan → RED (canStaySafe checked first)", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ canStaySafe: "no", hasPlan: true }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("nao_consegue_se_manter_seguro");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. SYNDROME RAIL TRUTH TABLE
// ═══════════════════════════════════════════════════════════════════

describe("Syndrome Rail", () => {
  it("Severe mania acute → RED", () => {
    const f = makeFeatures({ severeManiaAcute: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("mania_aguda_grave");
  });

  it("Mixed ORANGE (ASRM ≥ 6 + PHQ-9 ≥ 10 + corroborators) → ORANGE", () => {
    const f = makeFeatures({ mixedOrange: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("sinais_mistos_com_corroboracao");
  });

  it("Mixed YELLOW (ASRM ≥ 6 + PHQ-9 ≥ 10 without full corroboration) → YELLOW", () => {
    const f = makeFeatures({ mixedYellow: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("sinais_mistos_sem_corroboracao_completa");
  });

  it("Mania ORANGE → ORANGE", () => {
    const f = makeFeatures({ maniaOrange: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("sindrome_maniforme_provavel");
  });

  it("Mania YELLOW → YELLOW", () => {
    const f = makeFeatures({ maniaYellow: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("sinal_de_ativacao");
  });

  it("Depression ORANGE (PHQ-9 ≥ 15) → ORANGE", () => {
    const f = makeFeatures({ depressionOrange: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("sindrome_depressiva_relevante");
  });

  it("Depression YELLOW (PHQ-9 ≥ 10) → YELLOW", () => {
    const f = makeFeatures({ depressionYellow: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("sinal_depressivo");
  });

  it("No syndrome triggers → CLEAR", () => {
    const f = makeFeatures();
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("CLEAR");
    expect(result.reasons).toHaveLength(0);
  });

  it("Mixed ORANGE + mania ORANGE → ORANGE (max layer)", () => {
    const f = makeFeatures({ mixedOrange: true, maniaOrange: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("sinais_mistos_com_corroboracao");
    expect(result.reasons).toContain("sindrome_maniforme_provavel");
  });

  it("Mixed ORANGE + depression YELLOW → ORANGE (ORANGE wins)", () => {
    const f = makeFeatures({ mixedOrange: true, depressionYellow: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("ORANGE");
  });

  it("Mania YELLOW + depression YELLOW → YELLOW", () => {
    const f = makeFeatures({ maniaYellow: true, depressionYellow: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("sinal_de_ativacao");
    expect(result.reasons).toContain("sinal_depressivo");
  });

  it("Confidence is 'high' when scales are fresh", () => {
    const f = makeFeatures({ scalesFresh: true, maniaOrange: true });
    expect(evaluateSyndromeRail(f).confidence).toBe("high");
  });

  it("Confidence is 'medium' when scales are stale", () => {
    const f = makeFeatures({ scalesFresh: false, maniaOrange: true });
    expect(evaluateSyndromeRail(f).confidence).toBe("medium");
  });

  it("Severe mania RED takes priority over mixed ORANGE", () => {
    const f = makeFeatures({ severeManiaAcute: true, mixedOrange: true });
    const result = evaluateSyndromeRail(f);
    expect(result.layer).toBe("RED");
    expect(result.reasons).toContain("mania_aguda_grave");
    // Severe mania returns early, so mixedOrange reasons are not included
    expect(result.reasons).not.toContain("sinais_mistos_com_corroboracao");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. PRODROME RAIL TRUTH TABLE
// ═══════════════════════════════════════════════════════════════════

describe("Prodrome Rail", () => {
  it("2+ major prodromes + cross-domain → ORANGE", () => {
    const f = makeFeatures({
      prodromeOrange: true,
      sleepDropMajor: true,
      maniaWarningCluster: true,
      prodromeMajorCount: 2,
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("ORANGE prodrome includes specific reasons", () => {
    const f = makeFeatures({
      prodromeOrange: true,
      sleepDropMajor: true,
      spendingMateriality: true,
      medNonAdherenceMajor: true,
      prodromeMajorCount: 3,
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("ORANGE");
    expect(result.reasons).toContain("queda_sono_significativa");
    expect(result.reasons).toContain("gasto_atipico_material");
    expect(result.reasons).toContain("nao_adesao_medicacao_critica");
  });

  it("1 major prodrome → YELLOW", () => {
    const f = makeFeatures({
      prodromeYellow: true,
      sleepDropMajor: true,
      prodromeMajorCount: 1,
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("queda_sono_significativa");
  });

  it("2+ minor prodromes → YELLOW", () => {
    const f = makeFeatures({
      prodromeYellow: true,
      highEnergyRecent: true,
      lowMoodRecent: true,
      prodromeMinorCount: 2,
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.reasons).toContain("energia_elevada_recente");
    expect(result.reasons).toContain("humor_baixo_recente");
  });

  it("YELLOW prodrome reasons are capped at 3", () => {
    const f = makeFeatures({
      prodromeYellow: true,
      sleepDropMajor: true,
      shortSleepStreak: true,
      bedtimeDrift: true,
      highEnergyRecent: true,
      highIrritabilityRecent: true,
      lowMoodRecent: true,
      highAnxietyRecent: true,
      prodromeMajorCount: 2,
      prodromeMinorCount: 4,
    });
    const result = evaluateProdromeRail(f);
    expect(result.reasons.length).toBeLessThanOrEqual(3);
  });

  it("Low coverage caps at YELLOW even with prodrome signals", () => {
    const f = makeFeatures({
      prodromeOrange: true, // would normally be ORANGE
      prodromeMajorCount: 3,
      sleepDropMajor: true,
      maniaWarningCluster: true,
      coverage: makeCoverage({ sleepLowConfidence: true, entriesLast7d: 2 }),
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("YELLOW");
    expect(result.confidence).toBe("low");
    expect(result.reasons).toContain("prodromos_dados_insuficientes");
  });

  it("Low coverage with no prodromes → CLEAR", () => {
    const f = makeFeatures({
      prodromeMajorCount: 0,
      prodromeMinorCount: 0,
      coverage: makeCoverage({ sleepLowConfidence: true, entriesLast7d: 2 }),
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("CLEAR");
    expect(result.confidence).toBe("low");
  });

  it("No triggers → CLEAR", () => {
    const f = makeFeatures();
    const result = evaluateProdromeRail(f);
    expect(result.layer).toBe("CLEAR");
    expect(result.reasons).toHaveLength(0);
    expect(result.confidence).toBe("high");
  });

  it("Prodrome never produces RED", () => {
    // Even with maximal prodrome signals, layer should be ORANGE at most
    const f = makeFeatures({
      prodromeOrange: true,
      prodromeMajorCount: 6,
      prodromeMinorCount: 5,
      sleepDropMajor: true,
      shortSleepStreak: true,
      maniaWarningCluster: true,
      depressionWarningCluster: true,
      spendingMateriality: true,
      medNonAdherenceMajor: true,
    });
    const result = evaluateProdromeRail(f);
    expect(result.layer).not.toBe("RED");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. DERIVE FEATURES
// ═══════════════════════════════════════════════════════════════════

describe("Derive Features", () => {
  const TZ = "America/Sao_Paulo";

  function makeInput(overrides: Partial<DeriveFeaturesInput> = {}): DeriveFeaturesInput {
    return {
      entries: [],
      sleepLogs: [],
      financialTxs: [],
      latestWeekly: null,
      medications: [],
      latestSafetyScreen: null,
      todayWarningSigns: [],
      now: NOW,
      tz: TZ,
      ...overrides,
    };
  }

  function makeSleepLogs(
    days: number[],
    hours: number,
    baseDate: Date = NOW,
  ): SleepLogInput[] {
    return days.map((d) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - d);
      return {
        date: date.toLocaleDateString("sv-SE", { timeZone: TZ }),
        totalHours: hours,
        bedtime: null,
        quality: 3,
        excluded: false,
        hrv: null,
      };
    });
  }

  function makeDiaryEntries(
    days: number[],
    overrides: Partial<DiaryEntryInput> = {},
    baseDate: Date = NOW,
  ): DiaryEntryInput[] {
    return days.map((d) => {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - d);
      return {
        date: date.toLocaleDateString("sv-SE", { timeZone: TZ }),
        mood: 3,
        sleepHours: 7,
        energyLevel: null,
        anxietyLevel: null,
        irritability: null,
        warningSigns: null,
        tookMedication: null,
        ...overrides,
      };
    });
  }

  it("Sleep drop major detection: 2 of last 3 below baseline - 1.5h", () => {
    // Baseline: days 3-14 with 8h sleep (need ≥7 observations)
    const baselineLogs = makeSleepLogs([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 8);
    // Recent: days 0-1 with 5h (below 8 - 1.5 = 6.5)
    const recentLogs = makeSleepLogs([0, 1], 5);
    const input = makeInput({ sleepLogs: [...baselineLogs, ...recentLogs] });
    const features = deriveFeatures(input);
    expect(features.sleepDropMajor).toBe(true);
  });

  it("Sleep drop major NOT triggered with adequate sleep", () => {
    const baselineLogs = makeSleepLogs([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 8);
    const recentLogs = makeSleepLogs([0, 1], 7.5);
    const input = makeInput({ sleepLogs: [...baselineLogs, ...recentLogs] });
    const features = deriveFeatures(input);
    expect(features.sleepDropMajor).toBe(false);
  });

  it("Short sleep streak: 3 of last 5 days < 6h", () => {
    // Need enough data for 7-day coverage
    const logs = [
      ...makeSleepLogs([0, 1, 2], 4), // 3 short nights
      ...makeSleepLogs([3, 4], 7),      // 2 normal nights
      ...makeSleepLogs([5, 6], 7),      // fill coverage
    ];
    const input = makeInput({ sleepLogs: logs });
    const features = deriveFeatures(input);
    expect(features.shortSleepStreak).toBe(true);
  });

  it("Short sleep streak NOT triggered with only 2 short nights", () => {
    const logs = [
      ...makeSleepLogs([0, 1], 4),     // 2 short nights
      ...makeSleepLogs([2, 3, 4], 7),  // normal
      ...makeSleepLogs([5, 6], 7),     // fill coverage
    ];
    const input = makeInput({ sleepLogs: logs });
    const features = deriveFeatures(input);
    expect(features.shortSleepStreak).toBe(false);
  });

  it("Excluded sleep logs are filtered out", () => {
    const logs = makeSleepLogs([0, 1, 2, 3, 4, 5, 6], 4).map((l) => ({
      ...l,
      excluded: true,
    }));
    const input = makeInput({ sleepLogs: logs });
    const features = deriveFeatures(input);
    // All excluded → no sleep data → coverage low
    expect(features.coverage.sleepLowConfidence).toBe(true);
    expect(features.shortSleepStreak).toBe(false);
  });

  it("Nap logs (< 1h) are filtered out", () => {
    const logs = makeSleepLogs([0, 1, 2, 3, 4, 5, 6], 0.5); // all < 1h
    const input = makeInput({ sleepLogs: logs });
    const features = deriveFeatures(input);
    expect(features.coverage.sleepLowConfidence).toBe(true);
  });

  it("Stale scales (>8 days) don't set scalesFresh", () => {
    const staleDate = new Date(NOW);
    staleDate.setDate(staleDate.getDate() - 10);
    const input = makeInput({
      latestWeekly: {
        id: "w1",
        createdAt: staleDate,
        asrmTotal: 12,
        phq9Total: 20,
        phq9Item9: 2,
      },
    });
    const features = deriveFeatures(input);
    expect(features.scalesFresh).toBe(false);
    expect(features.coverage.scalesStale).toBe(true);
  });

  it("Fresh scales within 8 days are marked fresh", () => {
    const freshDate = new Date(NOW);
    freshDate.setDate(freshDate.getDate() - 5);
    const input = makeInput({
      latestWeekly: {
        id: "w1",
        createdAt: freshDate,
        asrmTotal: 8,
        phq9Total: 12,
        phq9Item9: 0,
      },
    });
    const features = deriveFeatures(input);
    expect(features.scalesFresh).toBe(true);
  });

  it("Mixed state requires BOTH ASRM ≥ 6 AND PHQ-9 ≥ 10", () => {
    const freshDate = new Date(NOW);
    freshDate.setDate(freshDate.getDate() - 2);

    // ASRM ≥ 6 only (PHQ-9 < 10) → no mixed
    const input1 = makeInput({
      latestWeekly: { id: "w1", createdAt: freshDate, asrmTotal: 8, phq9Total: 5, phq9Item9: 0 },
    });
    expect(deriveFeatures(input1).mixedCore).toBe(false);

    // PHQ-9 ≥ 10 only (ASRM < 6) → no mixed
    const input2 = makeInput({
      latestWeekly: { id: "w1", createdAt: freshDate, asrmTotal: 3, phq9Total: 15, phq9Item9: 0 },
    });
    expect(deriveFeatures(input2).mixedCore).toBe(false);

    // Both ≥ cutoffs → mixed core
    const input3 = makeInput({
      latestWeekly: { id: "w1", createdAt: freshDate, asrmTotal: 8, phq9Total: 12, phq9Item9: 0 },
    });
    expect(deriveFeatures(input3).mixedCore).toBe(true);
  });

  it("Stale scales do NOT trigger syndrome flags even with high scores", () => {
    const staleDate = new Date(NOW);
    staleDate.setDate(staleDate.getDate() - 10);
    const input = makeInput({
      latestWeekly: { id: "w1", createdAt: staleDate, asrmTotal: 15, phq9Total: 25, phq9Item9: 3 },
    });
    const features = deriveFeatures(input);
    expect(features.mixedCore).toBe(false);
    expect(features.maniaOrange).toBe(false);
    expect(features.depressionOrange).toBe(false);
    expect(features.severeManiaAcute).toBe(false);
  });

  it("Essential categories are excluded from spending calculations", () => {
    const freshDate = new Date(NOW);
    freshDate.setDate(freshDate.getDate() - 2);

    // Generate a lot of baseline transactions on different days
    const baselineTxs: FinancialTxInput[] = [];
    for (let d = 8; d <= 56; d++) {
      const date = new Date(NOW);
      date.setDate(date.getDate() - d);
      const dateStr = date.toLocaleDateString("sv-SE", { timeZone: TZ });
      baselineTxs.push({
        date: dateStr,
        amount: -50,
        category: "lazer",
        description: "bar",
      });
    }

    // Recent "essential" spending (should be excluded)
    const essentialTx: FinancialTxInput = {
      date: NOW.toLocaleDateString("sv-SE", { timeZone: TZ }),
      amount: -5000,
      category: "mercado",
      description: "compra mensal",
    };

    const input = makeInput({ financialTxs: [...baselineTxs, essentialTx] });
    const features = deriveFeatures(input);
    // Essential category should not trigger spending anomaly
    expect(features.spendingCandidate).toBe(false);
  });

  it("Spending robust Z-score filtering detects anomalies", () => {
    const baselineTxs: FinancialTxInput[] = [];
    // Create baseline with some variance: 30-70 per day for 49 days (days 8-56)
    for (let d = 8; d <= 56; d++) {
      const date = new Date(NOW);
      date.setDate(date.getDate() - d);
      const dateStr = date.toLocaleDateString("sv-SE", { timeZone: TZ });
      const amount = -(30 + (d % 5) * 10); // cycles 30,40,50,60,70
      baselineTxs.push({ date: dateStr, amount, category: "lazer", description: "" });
    }

    // Recent spike: 2 days with very high spending
    const spike1Date = new Date(NOW);
    spike1Date.setDate(spike1Date.getDate() - 1);
    const spike2Date = new Date(NOW);
    spike2Date.setDate(spike2Date.getDate() - 2);

    const spikes: FinancialTxInput[] = [
      { date: spike1Date.toLocaleDateString("sv-SE", { timeZone: TZ }), amount: -500, category: "lazer", description: "" },
      { date: spike2Date.toLocaleDateString("sv-SE", { timeZone: TZ }), amount: -500, category: "lazer", description: "" },
    ];

    const input = makeInput({ financialTxs: [...baselineTxs, ...spikes] });
    const features = deriveFeatures(input);
    expect(features.spendingCandidate).toBe(true);
  });

  it("Medication non-adherence detection", () => {
    const input = makeInput({
      medications: [
        { riskRole: "mood_stabilizer", adherence7d: 0.5, consecutiveMissed: 3 },
      ],
    });
    const features = deriveFeatures(input);
    expect(features.medNonAdherenceMajor).toBe(true);
  });

  it("Non-critical medication non-adherence does NOT flag", () => {
    const input = makeInput({
      medications: [
        { riskRole: "supplement", adherence7d: 0.3, consecutiveMissed: 5 },
      ],
    });
    const features = deriveFeatures(input);
    expect(features.medNonAdherenceMajor).toBe(false);
  });

  it("Safety screen parsing from JSON", () => {
    const asq: AsqResult = { q1: true, q2: false, q3: false, q4: false, q5CurrentThoughtsNow: true };
    const bssa: BssaResult = makeBssa({ canStaySafe: "no" });
    const input = makeInput({
      latestSafetyScreen: {
        id: "ss1",
        sourceAssessmentId: null,
        asq: JSON.stringify(asq),
        bssa: JSON.stringify(bssa),
        disposition: "RED",
        alertLayer: "RED",
        completedAt: new Date("2026-03-23T12:00:00Z"),
      },
    });
    const features = deriveFeatures(input);
    expect(features.latestAsq).toEqual(asq);
    expect(features.latestBssa).toEqual(bssa);
  });

  it("Severe mania acute requires ASRM ≥ 11 + ≥3 corroborators + danger signs", () => {
    const freshDate = new Date(NOW);
    freshDate.setDate(freshDate.getDate() - 2);

    // Need: high ASRM, many corroborators, danger signs
    const entries = makeDiaryEntries([0, 1, 2], {
      mood: 5,
      energyLevel: 5,
      irritability: 5,
      warningSigns: JSON.stringify(["agitacao", "pensamentos_acelerados", "gastos_impulsivos"]),
    });

    const sleepLogs = [
      ...makeSleepLogs([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 8), // baseline
      ...makeSleepLogs([0, 1, 2], 3), // recent drop
    ];

    const input = makeInput({
      entries,
      sleepLogs,
      latestWeekly: { id: "w1", createdAt: freshDate, asrmTotal: 15, phq9Total: 5, phq9Item9: 0 },
      todayWarningSigns: ["agitacao", "desinibicao"],
    });

    const features = deriveFeatures(input);
    expect(features.severeManiaAcute).toBe(true);
  });

  it("Low mood persistence: 2 of last 3 days with mood ≤ 2", () => {
    const entries = makeDiaryEntries([0, 1, 2], { mood: 1 });
    const input = makeInput({ entries });
    const features = deriveFeatures(input);
    expect(features.lowMoodRecent).toBe(true);
  });

  it("Warning sign cluster: weighted sum ≥ 3 for mania signs", () => {
    const entries = makeDiaryEntries([0, 1, 2], {
      warningSigns: JSON.stringify(["pensamentos_acelerados", "gastos_impulsivos", "energia_excessiva"]),
    });
    const input = makeInput({ entries });
    const features = deriveFeatures(input);
    expect(features.maniaWarningCluster).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. HYSTERESIS / STATE MACHINE
// ═══════════════════════════════════════════════════════════════════

describe("Hysteresis / State Machine", () => {
  const now = NOW;
  const clearRail = makeRailResult({ layer: "CLEAR" });
  const redSafetyRail = makeRailResult({ layer: "RED" });

  it("Safety RED is always immediate — no hysteresis", () => {
    const prev = makeEpisode({ layer: "YELLOW" });
    const result = applyHysteresis("YELLOW", redSafetyRail, prev, now);
    expect(result).toBe("RED");
  });

  it("Safety RED overrides any candidate", () => {
    const result = applyHysteresis("CLEAR", redSafetyRail, null, now);
    expect(result).toBe("RED");
  });

  it("No prior episode → accept candidate as-is", () => {
    expect(applyHysteresis("YELLOW", clearRail, null, now)).toBe("YELLOW");
    expect(applyHysteresis("ORANGE", clearRail, null, now)).toBe("ORANGE");
    expect(applyHysteresis("CLEAR", clearRail, null, now)).toBe("CLEAR");
  });

  it("Resolved episode → accept candidate as-is", () => {
    const resolved = makeEpisode({
      layer: "RED",
      resolvedAt: new Date("2026-03-22T00:00:00Z"),
    });
    expect(applyHysteresis("CLEAR", clearRail, resolved, now)).toBe("CLEAR");
  });

  it("RED holds for 12h minimum", () => {
    // RED triggered 6h ago → should hold
    const redEpisode = makeEpisode({
      layer: "RED",
      lastTriggeredAt: new Date(now.getTime() - 6 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, redEpisode, now);
    expect(result).toBe("RED");
  });

  it("RED releases after 12h but steps down to at least ORANGE", () => {
    const redEpisode = makeEpisode({
      layer: "RED",
      lastTriggeredAt: new Date(now.getTime() - 13 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, redEpisode, now);
    expect(result).toBe("ORANGE");
  });

  it("RED after hold period with YELLOW candidate → ORANGE (step-down floor)", () => {
    const redEpisode = makeEpisode({
      layer: "RED",
      lastTriggeredAt: new Date(now.getTime() - 13 * 3600000),
    });
    const result = applyHysteresis("YELLOW", clearRail, redEpisode, now);
    expect(result).toBe("ORANGE");
  });

  it("RED after hold period with ORANGE candidate → ORANGE", () => {
    const redEpisode = makeEpisode({
      layer: "RED",
      lastTriggeredAt: new Date(now.getTime() - 13 * 3600000),
    });
    const result = applyHysteresis("ORANGE", clearRail, redEpisode, now);
    expect(result).toBe("ORANGE");
  });

  it("ORANGE doesn't clear until 72h below", () => {
    // ORANGE triggered 48h ago, candidate is YELLOW → should hold at ORANGE
    const orangeEpisode = makeEpisode({
      layer: "ORANGE",
      lastTriggeredAt: new Date(now.getTime() - 48 * 3600000),
    });
    const result = applyHysteresis("YELLOW", clearRail, orangeEpisode, now);
    expect(result).toBe("ORANGE");
  });

  it("ORANGE with CLEAR candidate within 72h → YELLOW (gradual step-down)", () => {
    const orangeEpisode = makeEpisode({
      layer: "ORANGE",
      lastTriggeredAt: new Date(now.getTime() - 48 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, orangeEpisode, now);
    expect(result).toBe("YELLOW");
  });

  it("ORANGE clears after 72h with CLEAR candidate → CLEAR", () => {
    const orangeEpisode = makeEpisode({
      layer: "ORANGE",
      lastTriggeredAt: new Date(now.getTime() - 73 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, orangeEpisode, now);
    expect(result).toBe("CLEAR");
  });

  it("ORANGE with ORANGE candidate → stays ORANGE (regardless of time)", () => {
    const orangeEpisode = makeEpisode({
      layer: "ORANGE",
      lastTriggeredAt: new Date(now.getTime() - 100 * 3600000),
    });
    const orangeRail = makeRailResult({ layer: "CLEAR" });
    const result = applyHysteresis("ORANGE", orangeRail, orangeEpisode, now);
    expect(result).toBe("ORANGE");
  });

  it("YELLOW doesn't clear until 48h below", () => {
    const yellowEpisode = makeEpisode({
      layer: "YELLOW",
      lastTriggeredAt: new Date(now.getTime() - 24 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, yellowEpisode, now);
    expect(result).toBe("YELLOW");
  });

  it("YELLOW clears after 48h", () => {
    const yellowEpisode = makeEpisode({
      layer: "YELLOW",
      lastTriggeredAt: new Date(now.getTime() - 49 * 3600000),
    });
    const result = applyHysteresis("CLEAR", clearRail, yellowEpisode, now);
    expect(result).toBe("CLEAR");
  });

  it("YELLOW with YELLOW candidate → stays YELLOW", () => {
    const yellowEpisode = makeEpisode({
      layer: "YELLOW",
      lastTriggeredAt: new Date(now.getTime() - 100 * 3600000),
    });
    const result = applyHysteresis("YELLOW", clearRail, yellowEpisode, now);
    expect(result).toBe("YELLOW");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. CLINICAL MONOTONICITY
// ═══════════════════════════════════════════════════════════════════

describe("Clinical Monotonicity", () => {
  const LAYER_ORDER: Record<AlertLayer, number> = {
    CLEAR: 0,
    YELLOW: 1,
    ORANGE: 2,
    RED: 3,
  };

  function layerValue(layer: AlertLayer): number {
    return LAYER_ORDER[layer];
  }

  it("Adding suicidal ideation (ASQ acute) should never decrease any rail result", () => {
    // Start with various baseline scenarios
    const baselines: Partial<DerivedFeatures>[] = [
      {},
      { maniaOrange: true },
      { depressionOrange: true },
      { mixedOrange: true },
      { prodromeOrange: true, sleepDropMajor: true },
    ];

    for (const baseline of baselines) {
      const withoutSI = makeFeatures(baseline);
      const withSI = makeFeatures({
        ...baseline,
        latestAsq: makeAsq({ q1: true, q5CurrentThoughtsNow: true }),
      });

      const safetyBefore = evaluateSafetyRail(withoutSI);
      const safetyAfter = evaluateSafetyRail(withSI);
      expect(layerValue(safetyAfter.layer)).toBeGreaterThanOrEqual(layerValue(safetyBefore.layer));
    }
  });

  it("Adding mixed state should never decrease the syndrome rail", () => {
    const baselines: Partial<DerivedFeatures>[] = [
      {},
      { maniaYellow: true },
      { depressionYellow: true },
      { maniaOrange: true },
    ];

    for (const baseline of baselines) {
      const without = makeFeatures(baseline);
      const withMixed = makeFeatures({ ...baseline, mixedOrange: true });

      const syndromeBefore = evaluateSyndromeRail(without);
      const syndromeAfter = evaluateSyndromeRail(withMixed);
      expect(layerValue(syndromeAfter.layer)).toBeGreaterThanOrEqual(layerValue(syndromeBefore.layer));
    }
  });

  it("Adding prodrome signals should never decrease the prodrome rail", () => {
    const base = makeFeatures({ prodromeYellow: true, prodromeMajorCount: 1, sleepDropMajor: true });
    const elevated = makeFeatures({
      prodromeOrange: true,
      prodromeMajorCount: 3,
      sleepDropMajor: true,
      maniaWarningCluster: true,
      spendingMateriality: true,
    });

    const before = evaluateProdromeRail(base);
    const after = evaluateProdromeRail(elevated);
    expect(layerValue(after.layer)).toBeGreaterThanOrEqual(layerValue(before.layer));
  });

  it("maxLayer helper always returns the higher layer", () => {
    expect(maxLayer("CLEAR", "YELLOW")).toBe("YELLOW");
    expect(maxLayer("YELLOW", "CLEAR")).toBe("YELLOW");
    expect(maxLayer("YELLOW", "ORANGE")).toBe("ORANGE");
    expect(maxLayer("ORANGE", "RED")).toBe("RED");
    expect(maxLayer("RED", "CLEAR")).toBe("RED");
    expect(maxLayer("ORANGE", "ORANGE")).toBe("ORANGE");
  });

  it("Adding BSSA plan to existing YELLOW should escalate to ORANGE", () => {
    const yellow = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: ">1_year" }),
    });
    const orange = makeFeatures({
      latestBssa: makeBssa({ pastAttempt: ">1_year", hasPlan: true }),
    });

    const before = evaluateSafetyRail(yellow);
    const after = evaluateSafetyRail(orange);
    expect(before.layer).toBe("YELLOW");
    expect(after.layer).toBe("ORANGE");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. ACTIONS BUILDER
// ═══════════════════════════════════════════════════════════════════

describe("Actions Builder", () => {
  const clearResult = makeRailResult();
  const orangeSafety = makeRailResult({ layer: "ORANGE", reasons: ["asq_positivo"] });
  const orangeSafetyPending = makeRailResult({
    layer: "ORANGE",
    reasons: ["triagem_seguranca_pendente"],
    pending: true,
  });
  const orangeSyndrome = makeRailResult({ layer: "ORANGE", reasons: ["sindrome_maniforme_provavel"] });
  const yellowSyndrome = makeRailResult({ layer: "YELLOW", reasons: ["sinal_de_ativacao"] });
  const orangeProdrome = makeRailResult({ layer: "ORANGE", reasons: ["nao_adesao_medicacao_critica"] });

  it("RED includes call_192 and call_188", () => {
    const actions = buildActions("RED", clearResult, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("call_192");
    expect(ids).toContain("call_188");
    expect(ids).toContain("notify_support_contact");
    expect(ids).toContain("open_crisis_plan");
  });

  it("RED actions are all 'danger' variant", () => {
    const actions = buildActions("RED", clearResult, clearResult, clearResult);
    for (const action of actions) {
      expect(action.variant).toBe("danger");
    }
  });

  it("ORANGE never includes call_192", () => {
    const actions = buildActions("ORANGE", orangeSafety, orangeSyndrome, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).not.toContain("call_192");
  });

  it("ORANGE includes call_188", () => {
    const actions = buildActions("ORANGE", orangeSafety, orangeSyndrome, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("call_188");
  });

  it("ORANGE with pending safety screen includes open_safety_screen", () => {
    const actions = buildActions("ORANGE", orangeSafetyPending, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("open_safety_screen");
  });

  it("ORANGE without pending safety screen does NOT include open_safety_screen", () => {
    const actions = buildActions("ORANGE", orangeSafety, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).not.toContain("open_safety_screen");
  });

  it("ORANGE includes contact_caps and repeat_checkin", () => {
    const actions = buildActions("ORANGE", orangeSafety, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("contact_caps");
    expect(ids).toContain("repeat_checkin");
  });

  it("YELLOW has minimal actions (repeat_checkin + review_wellness_plan)", () => {
    const actions = buildActions("YELLOW", clearResult, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("repeat_checkin");
    expect(ids).toContain("review_wellness_plan");
    expect(ids).not.toContain("call_192");
    expect(ids).not.toContain("call_188");
  });

  it("YELLOW with syndrome reasons adds update_weekly_assessment", () => {
    const actions = buildActions("YELLOW", clearResult, yellowSyndrome, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("update_weekly_assessment");
  });

  it("YELLOW with medication prodrome adds update_weekly_assessment", () => {
    const actions = buildActions("YELLOW", clearResult, clearResult, orangeProdrome);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain("update_weekly_assessment");
  });

  it("YELLOW without syndrome/medication reasons does NOT add update_weekly_assessment", () => {
    const actions = buildActions("YELLOW", clearResult, clearResult, clearResult);
    const ids = actions.map((a) => a.id);
    expect(ids).not.toContain("update_weekly_assessment");
  });

  it("CLEAR returns empty actions", () => {
    const actions = buildActions("CLEAR", clearResult, clearResult, clearResult);
    expect(actions).toHaveLength(0);
  });

  it("RED actions are sorted by priority (lower number = more urgent)", () => {
    const actions = buildActions("RED", clearResult, clearResult, clearResult);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i].priority).toBeGreaterThanOrEqual(actions[i - 1].priority);
    }
  });

  it("ORANGE actions are sorted by priority", () => {
    const actions = buildActions("ORANGE", orangeSafetyPending, orangeSyndrome, clearResult);
    for (let i = 1; i < actions.length; i++) {
      expect(actions[i].priority).toBeGreaterThanOrEqual(actions[i - 1].priority);
    }
  });

  it("RED action call_192 has phone='192'", () => {
    const actions = buildActions("RED", clearResult, clearResult, clearResult);
    const samu = actions.find((a) => a.id === "call_192");
    expect(samu?.phone).toBe("192");
  });

  it("ORANGE action call_188 has phone='188'", () => {
    const actions = buildActions("ORANGE", orangeSafety, clearResult, clearResult);
    const cvv = actions.find((a) => a.id === "call_188");
    expect(cvv?.phone).toBe("188");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. EDGE CASES & INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe("Edge Cases", () => {
  it("ASQ all false + q5 true does NOT trigger (q5 only matters if q1-q4 positive)", () => {
    const f = makeFeatures({
      latestAsq: makeAsq({ q1: false, q2: false, q3: false, q4: false, q5CurrentThoughtsNow: true }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.layer).toBe("CLEAR");
  });

  it("PHQ-9 item 9 = 0 does not trigger any safety layer", () => {
    const f = makeFeatures({ latestPhq9Item9: 0, safetyScreenCompleted: false });
    expect(evaluateSafetyRail(f).layer).toBe("CLEAR");
  });

  it("PHQ-9 item 9 null does not trigger", () => {
    const f = makeFeatures({ latestPhq9Item9: null });
    expect(evaluateSafetyRail(f).layer).toBe("CLEAR");
  });

  it("BSSA null does not crash safety rail", () => {
    const f = makeFeatures({ latestBssa: null, latestAsq: null });
    expect(evaluateSafetyRail(f).layer).toBe("CLEAR");
  });

  it("Multiple RED triggers: first match wins (canStaySafe before thoughtRecency)", () => {
    const f = makeFeatures({
      latestBssa: makeBssa({ canStaySafe: "no", thoughtRecency: "now" }),
    });
    const result = evaluateSafetyRail(f);
    expect(result.reasons).toContain("nao_consegue_se_manter_seguro");
    expect(result.reasons).not.toContain("pensamentos_suicidas_agora");
  });

  it("Safety screen NOT completed with no PHQ-9 item 9 and no suicidal sign → no screen required from features alone", () => {
    const TZ = "America/Sao_Paulo";
    const input: DeriveFeaturesInput = {
      entries: [],
      sleepLogs: [],
      financialTxs: [],
      latestWeekly: null,
      medications: [],
      latestSafetyScreen: null,
      todayWarningSigns: [],
      now: NOW,
      tz: TZ,
    };
    const features = deriveFeatures(input);
    expect(features.safetyScreenRequired).toBe(false);
  });

  it("Today suicidal warning sign triggers safetyScreenRequired", () => {
    const TZ = "America/Sao_Paulo";
    const input: DeriveFeaturesInput = {
      entries: [],
      sleepLogs: [],
      financialTxs: [],
      latestWeekly: null,
      medications: [],
      latestSafetyScreen: null,
      todayWarningSigns: ["pensamentos_suicidas"],
      now: NOW,
      tz: TZ,
    };
    const features = deriveFeatures(input);
    expect(features.safetyScreenRequired).toBe(true);
    expect(features.todayHasSuicidalWarningSign).toBe(true);
  });

  it("Coverage: sleep low confidence when < 4 logs in 7 days", () => {
    const TZ = "America/Sao_Paulo";
    const logs: SleepLogInput[] = [0, 1, 2].map((d) => {
      const date = new Date(NOW);
      date.setDate(date.getDate() - d);
      return {
        date: date.toLocaleDateString("sv-SE", { timeZone: TZ }),
        totalHours: 7,
        bedtime: null,
        quality: 3,
        excluded: false,
        hrv: null,
      };
    });
    const input: DeriveFeaturesInput = {
      entries: [],
      sleepLogs: logs,
      financialTxs: [],
      latestWeekly: null,
      medications: [],
      latestSafetyScreen: null,
      todayWarningSigns: [],
      now: NOW,
      tz: TZ,
    };
    const features = deriveFeatures(input);
    expect(features.coverage.sleepLowConfidence).toBe(true);
  });

  it("Antipsychotic non-adherence also flags medNonAdherenceMajor", () => {
    const TZ = "America/Sao_Paulo";
    const input: DeriveFeaturesInput = {
      entries: [],
      sleepLogs: [],
      financialTxs: [],
      latestWeekly: null,
      medications: [{ riskRole: "antipsychotic", adherence7d: 0.6, consecutiveMissed: 0 }],
      latestSafetyScreen: null,
      todayWarningSigns: [],
      now: NOW,
      tz: TZ,
    };
    const features = deriveFeatures(input);
    expect(features.medNonAdherenceMajor).toBe(true);
  });

  it("Consecutive missed ≥ 2 flags medNonAdherenceMajor even with ok adherence%", () => {
    const TZ = "America/Sao_Paulo";
    const input: DeriveFeaturesInput = {
      entries: [],
      sleepLogs: [],
      financialTxs: [],
      latestWeekly: null,
      medications: [{ riskRole: "mood_stabilizer", adherence7d: 0.85, consecutiveMissed: 2 }],
      latestSafetyScreen: null,
      todayWarningSigns: [],
      now: NOW,
      tz: TZ,
    };
    const features = deriveFeatures(input);
    expect(features.medNonAdherenceMajor).toBe(true);
  });
});
