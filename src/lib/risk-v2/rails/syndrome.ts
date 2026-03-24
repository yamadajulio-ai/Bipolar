/**
 * Syndrome Rail — Mania/hypomania, depression, mixed features.
 *
 * Anchored on validated scales: ASRM (mania) + PHQ-9 (depression).
 * Mixed = ASRM ≥ 6 AND PHQ-9 ≥ 10 + corroborators.
 *
 * RED is possible for severe acute mania (psychiatric emergency even without suicidality):
 * ASRM ≥ 11 + ≥3 activation corroborators + dangerous signs (agitation, disinhibition, psychosis).
 */

import type { DerivedFeatures, RailResult } from "../types";
import { maxLayer, type AlertLayer } from "../types";

export function evaluateSyndromeRail(f: DerivedFeatures): RailResult {
  const reasons: string[] = [];
  let layer: AlertLayer = "CLEAR";

  // ── Severe acute mania — psychiatric emergency ─────────────────
  if (f.severeManiaAcute) {
    return {
      layer: "RED",
      reasons: ["mania_aguda_grave"],
      confidence: "high",
    };
  }

  // ── Mixed features ─────────────────────────────────────────────
  if (f.mixedOrange) {
    layer = "ORANGE";
    reasons.push("sinais_mistos_com_corroboracao");
  } else if (f.mixedYellow) {
    layer = maxLayer(layer, "YELLOW");
    reasons.push("sinais_mistos_sem_corroboracao_completa");
  }

  // ── Mania / Hypomania ─────────────────────────────────────────
  if (f.maniaOrange) {
    layer = maxLayer(layer, "ORANGE");
    reasons.push("sindrome_maniforme_provavel");
  } else if (f.maniaYellow) {
    layer = maxLayer(layer, "YELLOW");
    reasons.push("sinal_de_ativacao");
  }

  // ── Depression ─────────────────────────────────────────────────
  if (f.depressionOrange) {
    layer = maxLayer(layer, "ORANGE");
    reasons.push("sindrome_depressiva_relevante");
  } else if (f.depressionYellow) {
    layer = maxLayer(layer, "YELLOW");
    reasons.push("sinal_depressivo");
  }

  return {
    layer,
    reasons,
    confidence: f.scalesFresh ? "high" : "medium",
  };
}
