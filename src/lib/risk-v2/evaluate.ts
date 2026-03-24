/**
 * Risk v2 — Main Evaluator
 *
 * Orchestrates the 3-rail assessment and produces the final RiskSnapshot.
 * This is the single entry point called from /hoje and other pages.
 */

import type { RiskSnapshot, AlertLayer, RailResult } from "./types";
import { maxLayer, layerToUiMode } from "./types";
import { evaluateSafetyRail } from "./rails/safety";
import { evaluateSyndromeRail } from "./rails/syndrome";
import { evaluateProdromeRail } from "./rails/prodrome";
import { applyHysteresis, type AlertEpisodeState } from "./state-machine";
import { buildActions } from "./actions";
import type { DeriveFeaturesInput } from "./derive-features";
import { deriveFeatures } from "./derive-features";

export interface EvaluateInput extends DeriveFeaturesInput {
  userId: string;
  /** Previous open alert episode (for hysteresis). Null if none. */
  prevEpisode: AlertEpisodeState | null;
}

export function evaluateRisk(input: EvaluateInput): RiskSnapshot {
  const features = deriveFeatures(input);
  const localDate = input.now.toLocaleDateString("sv-SE", { timeZone: input.tz });

  // Evaluate each rail independently
  const safety: RailResult = evaluateSafetyRail(features);
  const syndrome: RailResult = evaluateSyndromeRail(features);
  const prodrome: RailResult = evaluateProdromeRail(features);

  // Candidate = max across all rails
  const candidate: AlertLayer = maxLayer(maxLayer(safety.layer, syndrome.layer), prodrome.layer);

  // Apply hysteresis (state machine)
  const finalLayer = applyHysteresis(candidate, safety, input.prevEpisode, input.now);

  // Collect unique reasons across all rails
  const allReasons = [...new Set([...safety.reasons, ...syndrome.reasons, ...prodrome.reasons])];

  // Build CTAs
  const actions = buildActions(finalLayer, safety, syndrome, prodrome);

  return {
    userId: input.userId,
    localDate,
    alertLayer: finalLayer,
    uiMode: layerToUiMode(finalLayer),
    rails: { safety, syndrome, prodrome },
    reasons: allReasons,
    actions: actions.map((a) => a.id),
    coverage: features.coverage,
  };
}

// Re-export everything consumers need
export { deriveFeatures } from "./derive-features";
export type { DeriveFeaturesInput } from "./derive-features";
export { evaluateSafetyRail } from "./rails/safety";
export { evaluateSyndromeRail } from "./rails/syndrome";
export { evaluateProdromeRail } from "./rails/prodrome";
export { applyHysteresis } from "./state-machine";
export { buildActions } from "./actions";
export { getHeadline, getDescription, reasonToLabel, DISCLAIMER, DISCLAIMER_SHORT } from "./copy";
export * from "./types";
export * from "./constants";
