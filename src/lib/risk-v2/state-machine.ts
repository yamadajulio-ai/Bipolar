/**
 * Risk v2 — State Machine (Hysteresis)
 *
 * Prevents alert flapping by requiring persistence before escalation
 * and delay before de-escalation.
 *
 * Rules:
 * - ANY → RED: immediate when safety rail = RED
 * - RED → ORANGE: only after RED_MIN_HOLD_HOURS without acute trigger
 * - ORANGE → YELLOW: after ORANGE_CLEAR_HOURS continuously below
 * - YELLOW → CLEAR: after YELLOW_CLEAR_HOURS continuously below
 * - Modal cooldown: don't repeat full-screen modal within MODAL_COOLDOWN_HOURS
 *   (except RED escalation)
 */

import type { AlertLayer, RailResult } from "./types";
import { maxLayer } from "./types";
import {
  YELLOW_CLEAR_HOURS,
  ORANGE_CLEAR_HOURS,
  ORANGE_HARD_CAP_HOURS,
  RED_MIN_HOLD_HOURS,
} from "./constants";

export interface AlertEpisodeState {
  layer: AlertLayer;
  startedAt: Date;
  lastTriggeredAt: Date;
  minHoldUntil: Date | null;
  modalCooldownUntil: Date | null;
  resolvedAt: Date | null;
}

export function applyHysteresis(
  candidate: AlertLayer,
  safetyRail: RailResult,
  prevEpisode: AlertEpisodeState | null,
  now: Date,
): AlertLayer {
  // Safety RED is always immediate — no hysteresis
  if (safetyRail.layer === "RED") return "RED";

  // No prior episode — accept candidate as-is
  if (!prevEpisode || prevEpisode.resolvedAt !== null) return candidate;

  const hoursSince = (from: Date) => (now.getTime() - from.getTime()) / 3600000;

  // RED → must hold for minimum period
  if (prevEpisode.layer === "RED") {
    if (hoursSince(prevEpisode.lastTriggeredAt) < RED_MIN_HOLD_HOURS) {
      return "RED";
    }
    // After hold period, step down to at least ORANGE
    return candidate === "CLEAR" ? "ORANGE" : maxLayer("ORANGE", candidate);
  }

  // ORANGE → candidate (but respect hard cap from episode start)
  if (candidate === "ORANGE") {
    // Hard cap: after ORANGE_HARD_CAP_HOURS from episode start, allow step-down
    if (hoursSince(prevEpisode.startedAt) >= ORANGE_HARD_CAP_HOURS) {
      return "YELLOW";
    }
    return "ORANGE";
  }

  // ORANGE → need sustained period below before clearing
  if (prevEpisode.layer === "ORANGE") {
    // Hard cap: if episode has been active ≥ ORANGE_HARD_CAP_HOURS, allow clearing
    if (hoursSince(prevEpisode.startedAt) >= ORANGE_HARD_CAP_HOURS) {
      return candidate; // accept whatever the candidate is (YELLOW or CLEAR)
    }
    if (hoursSince(prevEpisode.lastTriggeredAt) < ORANGE_CLEAR_HOURS) {
      // Still within hold period — don't drop below ORANGE if candidate is YELLOW
      if (candidate === "YELLOW") return "ORANGE";
      if (candidate === "CLEAR") return "YELLOW";
    }
  }

  // YELLOW → candidate
  if (candidate === "YELLOW") return "YELLOW";

  // YELLOW → need sustained period below before clearing
  if (prevEpisode.layer === "YELLOW") {
    if (hoursSince(prevEpisode.lastTriggeredAt) < YELLOW_CLEAR_HOURS) {
      return "YELLOW";
    }
  }

  return "CLEAR";
}
