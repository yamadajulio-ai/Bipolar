/**
 * Risk v2 — Constants
 *
 * All thresholds, windows, and timing constants for the 3-rail alert system.
 * Evidence-informed, not "validated in this app" — see spec v2 for references.
 */

export const TZ = "America/Sao_Paulo";

// ── Scale freshness ──────────────────────────────────────────────
/** Weekly assessment considered fresh if completed within this many days */
export const WEEKLY_SCALE_FRESH_DAYS = 8;

// ── Sleep baseline ───────────────────────────────────────────────
export const SLEEP_BASELINE_WINDOW_DAYS = 14;
export const SLEEP_BASELINE_MIN_OBS = 7;
/** Exclude last N days from baseline to detect acute change */
export const SLEEP_BASELINE_EXCLUDE_RECENT_DAYS = 2;

// ── Sleep thresholds ─────────────────────────────────────────────
/** Hours below which a night counts as "short" */
export const SHORT_SLEEP_HOURS = 6;
/** Delta from baseline that counts as "major drop" */
export const SLEEP_DROP_MAJOR_DELTA = 1.5;
/** Bedtime drift threshold in minutes */
export const BEDTIME_DRIFT_MINUTES = 120;

// ── Spending baseline ────────────────────────────────────────────
export const SPEND_BASELINE_WINDOW_DAYS = 56; // 8 weeks
export const SPEND_BASELINE_EXCLUDE_RECENT_DAYS = 7;
export const SPEND_BASELINE_MIN_TXNS = 12;
export const SPEND_BASELINE_MIN_DAYS = 21;
/** Robust Z-score threshold for spending anomaly */
export const SPEND_ROBUST_Z_THRESHOLD = 3;

// ── Persistence (2 of last 3 days) ──────────────────────────────
export const PERSIST_NUM = 2;
export const PERSIST_DEN = 3;

// ── Hysteresis / cooldown ────────────────────────────────────────
/** Hours YELLOW must stay below threshold before clearing */
export const YELLOW_CLEAR_HOURS = 48;
/** Hours ORANGE must stay below threshold before clearing */
export const ORANGE_CLEAR_HOURS = 72;
/** Minimum hours RED stays latched (even if safety reassessed) */
export const RED_MIN_HOLD_HOURS = 12;
/** Hours before a modal can re-appear (except RED escalation) */
export const MODAL_COOLDOWN_HOURS = 24;

// ── Scale cutoffs (evidence-based) ───────────────────────────────
/** ASRM ≥ 6: sensitivity ~85.5%, specificity ~87.3% for hypomania */
export const ASRM_HYPOMANIA_CUTOFF = 6;
/** ASRM threshold for sub-threshold activation signal */
export const ASRM_ACTIVATION_CUTOFF = 4;
/** PHQ-9 ≥ 10: moderate depression (88%/88% sens/spec original study) */
export const PHQ9_MODERATE_CUTOFF = 10;
/** PHQ-9 ≥ 15: moderately severe depression */
export const PHQ9_SEVERE_CUTOFF = 15;

/** ASRM ≥ 11: strongly elevated — suggests full mania (not just hypomania) */
export const ASRM_SEVERE_MANIA_CUTOFF = 11;
/** Minimum activation corroborators for severe mania RED (psychiatric emergency) */
export const SEVERE_MANIA_MIN_CORROBORATORS = 3;

// ── Medication adherence ─────────────────────────────────────────
/** Adherence below this for mood stabilizers/antipsychotics = major concern */
export const MED_NONADHERENCE_THRESHOLD = 0.80;
/** Consecutive missed scheduled doses threshold */
export const MED_CONSECUTIVE_MISSED_THRESHOLD = 2;

// ── Prodrome thresholds ──────────────────────────────────────────
/** Minimum major prodromes to reach ORANGE (with persistence) */
export const PRODROME_MAJOR_ORANGE_MIN = 2;

// ── Warning sign salience weights ────────────────────────────────
export const SALIENCE_WEIGHTS = { 1: 1, 2: 1.5, 3: 2 } as const;
/** Weighted count threshold for warning sign cluster */
export const WARNING_CLUSTER_THRESHOLD = 3;

// ── Essential spending categories (excluded from discretionary) ──
export const ESSENTIAL_CATEGORIES = new Set([
  "mercado",
  "supermercado",
  "farmácia",
  "farmacia",
  "moradia",
  "aluguel",
  "condomínio",
  "condominio",
  "conta",
  "contas",
  "luz",
  "água",
  "agua",
  "internet",
  "telefone",
  "transporte",
  "uber",
  "combustível",
  "combustivel",
  "saúde",
  "saude",
  "plano de saúde",
  "educação",
  "educacao",
  "escola",
  "faculdade",
]);
