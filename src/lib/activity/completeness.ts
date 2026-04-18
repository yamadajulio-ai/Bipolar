/**
 * Data completeness / wear-time estimate (ADR-011 Movimento e Ritmo).
 *
 * Without this, we would confuse "didn't wear the watch" with "was inactive"
 * — which GPT Pro explicitly flagged as clinically toxic. We combine three
 * signals, since no single wearable guarantees wear-time in the HAE payload:
 *
 *  1. Presence of steps data (any non-zero value today)
 *  2. Presence of HRV or HR during sleep window
 *  3. Session count (workouts captured)
 *
 * Output is 0..1. The risk engine requires >=0.5 to consider any alert.
 */

export interface CompletenessInput {
  hasSteps: boolean;
  stepCount: number | null;
  hasSleepLog: boolean;           // SleepLog for this date exists
  hasHrvOrHr: boolean;            // HRV or restingHR present today
  sessionCount: number;           // 0 is fine; just need one completeness signal
  sourceMix?: Record<string, number>; // optional, for telemetry
}

/**
 * Completeness heuristic. Each signal contributes 0..1 and we take a weighted
 * average. Tuning is intentional: steps carry the most weight because HAE
 * always exports them when the watch was worn, even without workouts.
 */
export function computeDataCompleteness(input: CompletenessInput): number {
  const stepsSignal = input.hasSteps
    ? input.stepCount && input.stepCount > 200
      ? 1.0       // clearly worn
      : 0.4       // steps present but suspiciously low (phone sitting on desk)
    : 0;

  const sleepSignal = input.hasSleepLog ? 1.0 : 0;
  const hrvHrSignal = input.hasHrvOrHr ? 1.0 : 0;

  // Session count signal: capped so that a single workout doesn't fake
  // full-day completeness.
  const sessionSignal = Math.min(1, input.sessionCount * 0.5);

  // Weights sum to 1.0
  const completeness =
    stepsSignal * 0.5 +
    sleepSignal * 0.2 +
    hrvHrSignal * 0.2 +
    sessionSignal * 0.1;

  return Math.max(0, Math.min(1, round2(completeness)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
