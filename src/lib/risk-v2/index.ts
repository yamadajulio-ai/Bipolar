/**
 * Risk v2 — Public API
 *
 * 3-rail alert system: safety, syndrome, prodrome.
 * RED = acute safety only. ORANGE = clinical urgency. YELLOW = monitoring.
 */

export { evaluateRisk } from "./evaluate";
export type { EvaluateInput } from "./evaluate";
export { deriveFeatures } from "./derive-features";
export type { DeriveFeaturesInput } from "./derive-features";
export { evaluateSafetyRail } from "./rails/safety";
export { evaluateSyndromeRail } from "./rails/syndrome";
export { evaluateProdromeRail } from "./rails/prodrome";
export { applyHysteresis } from "./state-machine";
export type { AlertEpisodeState } from "./state-machine";
export { buildActions } from "./actions";
export { getHeadline, getDescription, reasonToLabel, DISCLAIMER, DISCLAIMER_SHORT } from "./copy";
export * from "./types";
export * from "./constants";
