/**
 * Syndrome Rail — Mania/hypomania, depression, mixed features.
 *
 * Anchored on validated scales: ASRM (mania) + PHQ-9 (depression).
 * Mixed = ASRM ≥ 6 AND PHQ-9 ≥ 10 + corroborators.
 *
 * NEVER produces RED. Maximum is ORANGE.
 */

import type { DerivedFeatures, RailResult } from "../types";
import { maxLayer, type AlertLayer } from "../types";

export function evaluateSyndromeRail(f: DerivedFeatures): RailResult {
  const reasons: string[] = [];
  let layer: AlertLayer = "CLEAR";

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
