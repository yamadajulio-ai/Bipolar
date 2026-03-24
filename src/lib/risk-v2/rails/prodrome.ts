/**
 * Prodrome Rail — Early warning signs of relapse.
 *
 * Sleep disruption, warning sign clusters, spending anomalies,
 * medication non-adherence, mood/energy changes.
 *
 * NEVER produces RED. Maximum is ORANGE (with persistence + cross-domain).
 * Low-coverage data caps at YELLOW.
 */

import type { DerivedFeatures, RailResult } from "../types";

export function evaluateProdromeRail(f: DerivedFeatures): RailResult {
  // Low coverage: cap at YELLOW
  if (f.coverage.sleepLowConfidence && f.coverage.entriesLast7d < 3) {
    if (f.prodromeMajorCount > 0 || f.prodromeMinorCount > 0) {
      return { layer: "YELLOW", reasons: ["prodromos_dados_insuficientes"], confidence: "low" };
    }
    return { layer: "CLEAR", reasons: [], confidence: "low" };
  }

  // ── ORANGE: Persistent cross-domain prodromes ──────────────────
  if (f.prodromeOrange) {
    const reasons: string[] = [];
    if (f.sleepDropMajor) reasons.push("queda_sono_significativa");
    if (f.shortSleepStreak) reasons.push("noites_curtas_consecutivas");
    if (f.maniaWarningCluster) reasons.push("sinais_ativacao_agrupados");
    if (f.depressionWarningCluster) reasons.push("sinais_rebaixamento_agrupados");
    if (f.spendingMateriality) reasons.push("gasto_atipico_material");
    if (f.medNonAdherenceMajor) reasons.push("nao_adesao_medicacao_critica");
    return { layer: "ORANGE", reasons, confidence: "medium" };
  }

  // ── YELLOW: Isolated prodromes ─────────────────────────────────
  if (f.prodromeYellow) {
    const reasons: string[] = [];
    if (f.sleepDropMajor) reasons.push("queda_sono_significativa");
    if (f.shortSleepStreak) reasons.push("noites_curtas_consecutivas");
    if (f.bedtimeDrift) reasons.push("mudanca_horario_sono");
    if (f.maniaWarningCluster) reasons.push("sinais_ativacao_agrupados");
    if (f.depressionWarningCluster) reasons.push("sinais_rebaixamento_agrupados");
    if (f.spendingMateriality || f.spendingCandidate) reasons.push("gasto_acima_padrao");
    if (f.medNonAdherenceMajor) reasons.push("nao_adesao_medicacao_critica");
    if (f.highEnergyRecent) reasons.push("energia_elevada_recente");
    if (f.highIrritabilityRecent) reasons.push("irritabilidade_elevada_recente");
    if (f.lowMoodRecent) reasons.push("humor_baixo_recente");
    if (f.highAnxietyRecent) reasons.push("ansiedade_elevada_recente");
    return { layer: "YELLOW", reasons: reasons.slice(0, 3), confidence: "medium" };
  }

  return { layer: "CLEAR", reasons: [], confidence: "high" };
}
