/**
 * Risk v2 — Type definitions
 *
 * 3-rail alert system: safety, syndrome, prodrome.
 * RED = acute safety only. ORANGE = clinical urgency. YELLOW = monitoring.
 */

// ── Alert layers ─────────────────────────────────────────────────

export type AlertLayer = "CLEAR" | "YELLOW" | "ORANGE" | "RED";

export type UiMode = "default" | "support" | "safety";

export type Rail = "safety" | "syndrome" | "prodrome";

export type Confidence = "low" | "medium" | "high";

// ── Rail results ─────────────────────────────────────────────────

export interface RailResult {
  layer: AlertLayer;
  reasons: string[];
  confidence: Confidence;
  /** True if action is needed from user (e.g. safety screen pending) */
  pending?: boolean;
}

// ── Final snapshot ───────────────────────────────────────────────

export interface RiskSnapshot {
  userId: string;
  localDate: string; // YYYY-MM-DD in America/Sao_Paulo
  alertLayer: AlertLayer;
  uiMode: UiMode;
  rails: {
    safety: RailResult;
    syndrome: RailResult;
    prodrome: RailResult;
  };
  reasons: string[];
  actions: string[];
  coverage: CoverageFlags;
}

// ── Coverage / data quality ──────────────────────────────────────

export interface CoverageFlags {
  sleepLowConfidence: boolean;
  spendLowConfidence: boolean;
  scalesStale: boolean;
  /** Number of diary entries in last 7 days */
  entriesLast7d: number;
  /** Number of sleep logs in last 7 days */
  sleepLast7d: number;
}

// ── ASQ (Ask Suicide-Screening Questions) ────────────────────────

export interface AsqResult {
  /** Q1: In the past few weeks, have you wished you were dead? */
  q1: boolean;
  /** Q2: In the past few weeks, have you felt that you or your family would be better off if you were dead? */
  q2: boolean;
  /** Q3: In the past week, have you been having thoughts about killing yourself? */
  q3: boolean;
  /** Q4: Have you ever tried to kill yourself? */
  q4: boolean;
  /** Q5 (only if any q1-q4 = true): Are you having thoughts of killing yourself right now? */
  q5CurrentThoughtsNow?: boolean;
}

export function asqPositive(asq: AsqResult): boolean {
  return asq.q1 || asq.q2 || asq.q3 || asq.q4;
}

export function asqAcutePositive(asq: AsqResult): boolean {
  return asqPositive(asq) && asq.q5CurrentThoughtsNow === true;
}

// ── BSSA (Brief Suicide Safety Assessment) ───────────────────────

export type ThoughtRecency = "now" | "today" | "2_7_days" | "8_30_days" | ">30_days";
export type ThoughtFrequency = "once" | "occasional" | "daily" | "many_times_day";
export type PastAttemptRecency = "never" | ">1_year" | "3_12_months" | "<3_months" | "<7_days";
export type IntentToAct = "yes" | "unsure" | "no";
export type PlanTimeline = "unspecified" | "vague" | "within_weeks" | "within_days" | "today";

export interface BssaResult {
  thoughtRecency: ThoughtRecency;
  thoughtFrequency: ThoughtFrequency;
  hasPlan: boolean;
  planIsDetailed: boolean;
  hasAccessToMeans: boolean;
  /** Does the person intend to act on the plan? (NIMH BSSA key question) */
  intentToAct: IntentToAct;
  /** When does the person intend to act? (temporal specificity) */
  planTimeline: PlanTimeline;
  pastAttempt: PastAttemptRecency;
  preparatoryBehavior: PastAttemptRecency;
  canStaySafe: "yes" | "unsure" | "no";
}

// ── Features (derived from raw data) ─────────────────────────────

export interface DerivedFeatures {
  // Sleep
  sleepDropMajor: boolean;
  shortSleepStreak: boolean;
  bedtimeDrift: boolean;

  // Mood / daily check-ins
  lowMoodRecent: boolean;
  highEnergyRecent: boolean;
  highAnxietyRecent: boolean;
  highIrritabilityRecent: boolean;

  // Warning signs
  maniaWarningCluster: boolean;
  depressionWarningCluster: boolean;

  // Medication
  medNonAdherenceMajor: boolean;

  // Spending
  spendingCandidate: boolean;
  spendingMateriality: boolean;
  sameDayActivationCorroborator: boolean;

  // Scales (from weekly assessment)
  latestAsrmTotal: number | null;
  latestPhq9Total: number | null;
  latestPhq9Item9: number | null;
  scalesFresh: boolean;
  /** Whether ASRM and PHQ-9 were completed within 72h of each other */
  sameAssessmentWindow: boolean;

  // Safety
  todayHasSuicidalWarningSign: boolean;
  safetyScreenRequired: boolean;
  safetyScreenCompleted: boolean;
  latestAsq: AsqResult | null;
  latestBssa: BssaResult | null;

  // Syndrome derived
  mixedCore: boolean;
  mixedOrange: boolean;
  mixedYellow: boolean;
  maniaOrange: boolean;
  maniaYellow: boolean;
  depressionOrange: boolean;
  depressionYellow: boolean;

  /** Severe mania: ASRM ≥ 11 + ≥3 corroborators + dangerous signs — psychiatric emergency even without suicidality */
  severeManiaAcute: boolean;

  // Prodrome derived
  prodromeMajorCount: number;
  prodromeMinorCount: number;
  prodromeOrange: boolean;
  prodromeYellow: boolean;

  // Activation corroborators count
  activationCorroborators: number;
  distressCorroborators: number;

  // Coverage
  coverage: CoverageFlags;
}

// ── Input types (from Prisma) ────────────────────────────────────

export interface DiaryEntryInput {
  date: string;
  mood: number;
  sleepHours: number;
  energyLevel: number | null;
  anxietyLevel: number | null;
  irritability: number | null;
  warningSigns: string | null;
  tookMedication: string | null;
}

export interface SleepLogInput {
  date: string;
  totalHours: number;
  bedtime: Date | string | null;
  quality: number | null;
  excluded: boolean;
  hrv: number | null;
}

export interface FinancialTxInput {
  date: string;
  amount: number;
  category: string | null;
  description: string | null;
}

export interface WeeklyAssessmentInput {
  id: string;
  createdAt: Date;
  asrmTotal: number | null;
  phq9Total: number | null;
  phq9Item9: number | null;
}

export interface MedicationAdherenceInput {
  riskRole: string;
  adherence7d: number; // 0-1
  consecutiveMissed: number;
}

export interface SafetyScreeningInput {
  id: string;
  sourceAssessmentId: string | null;
  asq: string | null; // JSON
  bssa: string | null; // JSON
  disposition: string;
  alertLayer: string;
  completedAt: Date | null;
}

// ── Pending actions ──────────────────────────────────────────────

export type ActionId =
  | "call_192"
  | "call_188"
  | "open_crisis_plan"
  | "notify_support_contact"
  | "open_safety_screen"
  | "contact_professional_72h"
  | "contact_caps"
  | "repeat_checkin"
  | "update_weekly_assessment"
  | "review_wellness_plan"
  | "open_sos";

export interface PendingAction {
  id: ActionId;
  label: string;
  href?: string;
  phone?: string;
  priority: number; // lower = more urgent
  variant: "danger" | "warning" | "neutral";
}

// ── Helpers ──────────────────────────────────────────────────────

const LAYER_ORDER: Record<AlertLayer, number> = {
  CLEAR: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
};

export function maxLayer(a: AlertLayer, b: AlertLayer): AlertLayer {
  return LAYER_ORDER[a] >= LAYER_ORDER[b] ? a : b;
}

export function layerToUiMode(layer: AlertLayer): UiMode {
  if (layer === "RED") return "safety";
  if (layer === "ORANGE") return "support";
  return "default";
}
