/**
 * Safety Rail — Suicide risk and acute danger assessment.
 *
 * RED = acute safety risk (ASQ acute positive, BSSA imminent, recent attempt).
 * ORANGE = non-acute concern (pending screen, ASQ positive, plan, past attempt <12mo).
 * YELLOW = historical/low-grade signal.
 *
 * Based on NIMH ASQ Toolkit + BSSA pathway.
 * RED is the ONLY layer that shows SAMU 192 and simplified UI.
 */

import type { DerivedFeatures, RailResult } from "../types";
import { asqPositive, asqAcutePositive } from "../types";

export function evaluateSafetyRail(f: DerivedFeatures): RailResult {
  // ── RED: Acute imminent risk ───────────────────────────────────
  if (f.latestAsq && asqAcutePositive(f.latestAsq)) {
    return { layer: "RED", reasons: ["ideacao_suicida_aguda"], confidence: "high" };
  }

  if (f.latestBssa) {
    if (f.latestBssa.canStaySafe === "no") {
      return { layer: "RED", reasons: ["nao_consegue_se_manter_seguro"], confidence: "high" };
    }
    if (f.latestBssa.thoughtRecency === "now") {
      return { layer: "RED", reasons: ["pensamentos_suicidas_agora"], confidence: "high" };
    }
    if (f.latestBssa.hasPlan && f.latestBssa.planIsDetailed && f.latestBssa.hasAccessToMeans) {
      return { layer: "RED", reasons: ["plano_detalhado_com_acesso_a_meios"], confidence: "high" };
    }
    if (f.latestBssa.pastAttempt === "<3_months" || f.latestBssa.pastAttempt === "<7_days") {
      return { layer: "RED", reasons: ["tentativa_recente"], confidence: "high" };
    }
    if (f.latestBssa.preparatoryBehavior === "<3_months" || f.latestBssa.preparatoryBehavior === "<7_days") {
      return { layer: "RED", reasons: ["comportamento_preparatorio_recente"], confidence: "high" };
    }
  }

  // ── ORANGE: Non-acute safety concern ───────────────────────────
  if (f.safetyScreenRequired && !f.safetyScreenCompleted) {
    return { layer: "ORANGE", reasons: ["triagem_seguranca_pendente"], confidence: "medium", pending: true };
  }

  if (f.latestAsq && asqPositive(f.latestAsq)) {
    return { layer: "ORANGE", reasons: ["asq_positivo"], confidence: "high" };
  }

  if (f.latestBssa) {
    if (f.latestBssa.hasPlan) {
      return { layer: "ORANGE", reasons: ["plano_suicida_presente"], confidence: "high" };
    }
    if (f.latestBssa.canStaySafe === "unsure") {
      return { layer: "ORANGE", reasons: ["incerto_sobre_seguranca"], confidence: "high" };
    }
    if (f.latestBssa.pastAttempt === "3_12_months") {
      return { layer: "ORANGE", reasons: ["tentativa_ultimos_12_meses"], confidence: "high" };
    }
    if (f.latestBssa.preparatoryBehavior === "3_12_months") {
      return { layer: "ORANGE", reasons: ["preparacao_ultimos_12_meses"], confidence: "high" };
    }
    if (f.latestBssa.thoughtRecency === "today" || f.latestBssa.thoughtRecency === "2_7_days") {
      return { layer: "ORANGE", reasons: ["ideacao_recente"], confidence: "high" };
    }
  }

  if (f.latestPhq9Item9 !== null && f.latestPhq9Item9 >= 1 && !f.safetyScreenCompleted) {
    return { layer: "ORANGE", reasons: ["phq9_item9_positivo_sem_triagem"], confidence: "medium", pending: true };
  }

  // ── PHQ-9 item 9 restratification (after completed screening) ───
  // Item 9 frequency matters: 3 = nearly every day → higher risk
  // Modifiers: mixed state, severe depression, BSSA risk factors, past attempt
  if (f.latestPhq9Item9 !== null && f.latestPhq9Item9 >= 1 && f.safetyScreenCompleted) {
    const highFrequency = f.latestPhq9Item9 >= 3; // Nearly every day
    const moderateFrequency = f.latestPhq9Item9 >= 2; // More than half the days
    const hasRiskModifier = f.mixedOrange || f.depressionOrange ||
      (f.latestBssa && (
        f.latestBssa.thoughtFrequency === "daily" || f.latestBssa.thoughtFrequency === "many_times_day" ||
        f.latestBssa.pastAttempt !== "never"
      ));

    if (highFrequency) {
      // Nearly every day = ORANGE regardless of screening result
      return { layer: "ORANGE", reasons: ["phq9_item9_frequente"], confidence: "high" };
    }
    if (moderateFrequency && hasRiskModifier) {
      // More than half + modifier = ORANGE
      return { layer: "ORANGE", reasons: ["phq9_item9_moderado_com_modificador"], confidence: "high" };
    }
    // Low frequency (several days) with completed screening = YELLOW
    return { layer: "YELLOW", reasons: ["phq9_item9_positivo_triagem_ok"], confidence: "medium" };
  }

  // ── YELLOW: Historical or low-grade signal ─────────────────────
  if (f.latestBssa && f.latestBssa.pastAttempt === ">1_year") {
    return { layer: "YELLOW", reasons: ["historico_tentativa_remota"], confidence: "medium" };
  }

  if (f.todayHasSuicidalWarningSign && f.safetyScreenCompleted) {
    return { layer: "YELLOW", reasons: ["sinal_suicida_com_triagem_ok"], confidence: "medium" };
  }

  return { layer: "CLEAR", reasons: [], confidence: "high" };
}
