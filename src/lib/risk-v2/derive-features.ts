/**
 * Risk v2 — Feature derivation
 *
 * Transforms raw Prisma data into DerivedFeatures for the 3-rail evaluator.
 */

/** Convert bedtime (Date or ISO string) to minutes since midnight */
function bedtimeToMinutes(bedtime: Date | string): number {
  const d = typeof bedtime === "string" ? new Date(bedtime) : bedtime;
  return d.getHours() * 60 + d.getMinutes();
}

import {
  SLEEP_BASELINE_WINDOW_DAYS,
  SLEEP_BASELINE_MIN_OBS,
  SLEEP_BASELINE_EXCLUDE_RECENT_DAYS,
  SHORT_SLEEP_HOURS,
  SLEEP_DROP_MAJOR_DELTA,
  BEDTIME_DRIFT_MINUTES,
  SPEND_BASELINE_WINDOW_DAYS,
  SPEND_BASELINE_EXCLUDE_RECENT_DAYS,
  SPEND_BASELINE_MIN_TXNS,
  SPEND_BASELINE_MIN_DAYS,
  SPEND_ROBUST_Z_THRESHOLD,
  WEEKLY_SCALE_FRESH_DAYS,
  MED_NONADHERENCE_THRESHOLD,
  MED_CONSECUTIVE_MISSED_THRESHOLD,
  ESSENTIAL_CATEGORIES,
  ASRM_HYPOMANIA_CUTOFF,
  ASRM_ACTIVATION_CUTOFF,
  ASRM_SEVERE_MANIA_CUTOFF,
  SEVERE_MANIA_MIN_CORROBORATORS,
  PHQ9_MODERATE_CUTOFF,
  PHQ9_SEVERE_CUTOFF,
  WARNING_CLUSTER_THRESHOLD,
  SALIENCE_WEIGHTS,
} from "./constants";
import type {
  DerivedFeatures,
  DiaryEntryInput,
  SleepLogInput,
  FinancialTxInput,
  WeeklyAssessmentInput,
  MedicationAdherenceInput,
  SafetyScreeningInput,
  CoverageFlags,
  AsqResult,
  BssaResult,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(arr: number[]): number {
  const med = median(arr);
  const deviations = arr.map((x) => Math.abs(x - med));
  return median(deviations);
}

function robustZ(value: number, med: number, madVal: number): number {
  const sigma = madVal * 1.4826;
  if (sigma === 0) return 0;
  return (value - med) / sigma;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function parseStringArray(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000));
}

function dateStr(d: Date, tz: string): string {
  return d.toLocaleDateString("sv-SE", { timeZone: tz });
}

// ── Default warning signs (before user personalizes) ─────────────

const DEFAULT_MANIA_SIGNS = new Set([
  "pensamentos_acelerados",
  "gastos_impulsivos",
  "energia_excessiva",
  "planos_grandiosos",
  "fala_rapida",
  "sono_reduzido",
  "aumento_atividade",
  "agitacao",
  "desinibicao",
  "agressividade",
  "psicose",
  "alucinacoes",
  "delirios",
  "incapacidade_autocuidado",
]);

const DEFAULT_DEPRESSION_SIGNS = new Set([
  "isolamento",
  "desinteresse",
  "desesperanca",
  "apetite_alterado",
  "dificuldade_concentracao",
  "pensamentos_suicidas",
  "lentificacao",
  "culpa",
]);

// ── Main derivation function ─────────────────────────────────────

export interface DeriveFeaturesInput {
  entries: DiaryEntryInput[];
  sleepLogs: SleepLogInput[];
  financialTxs: FinancialTxInput[];
  latestWeekly: WeeklyAssessmentInput | null;
  medications: MedicationAdherenceInput[];
  latestSafetyScreen: SafetyScreeningInput | null;
  todayWarningSigns: string[];
  now: Date;
  tz: string;
}

export function deriveFeatures(input: DeriveFeaturesInput): DerivedFeatures {
  const { entries, sleepLogs, financialTxs, latestWeekly, medications, latestSafetyScreen, todayWarningSigns, now, tz } = input;

  const todayStr = dateStr(now, tz);

  // ── Sort data ────────────────────────────────────────────────
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSleep = [...sleepLogs].filter((s) => !s.excluded && s.totalHours >= 1).sort((a, b) => a.date.localeCompare(b.date));

  // Date cutoffs
  const d3Ago = new Date(now); d3Ago.setDate(d3Ago.getDate() - 2);
  const str3 = dateStr(d3Ago, tz);
  const d7Ago = new Date(now); d7Ago.setDate(d7Ago.getDate() - 6);
  const str7 = dateStr(d7Ago, tz);

  const last3Entries = sortedEntries.filter((e) => e.date >= str3);
  const last7Entries = sortedEntries.filter((e) => e.date >= str7);
  const last3Sleep = sortedSleep.filter((s) => s.date >= str3);
  const last5Sleep = sortedSleep.filter((s) => {
    const d5Ago = new Date(now); d5Ago.setDate(d5Ago.getDate() - 4);
    return s.date >= dateStr(d5Ago, tz);
  });
  const last7Sleep = sortedSleep.filter((s) => s.date >= str7);

  // ── Coverage ─────────────────────────────────────────────────
  const coverage: CoverageFlags = {
    sleepLowConfidence: last7Sleep.length < 4,
    spendLowConfidence: false, // computed below
    scalesStale: !latestWeekly || daysBetween(latestWeekly.createdAt, now) > WEEKLY_SCALE_FRESH_DAYS,
    entriesLast7d: last7Entries.length,
    sleepLast7d: last7Sleep.length,
  };

  // ── Sleep features ───────────────────────────────────────────
  const baselineExcludeCutoff = new Date(now);
  baselineExcludeCutoff.setDate(baselineExcludeCutoff.getDate() - SLEEP_BASELINE_EXCLUDE_RECENT_DAYS);
  const baselineStart = new Date(now);
  baselineStart.setDate(baselineStart.getDate() - SLEEP_BASELINE_WINDOW_DAYS);

  const baselineSleepLogs = sortedSleep.filter(
    (s) => s.date >= dateStr(baselineStart, tz) && s.date < dateStr(baselineExcludeCutoff, tz),
  );
  const baselineSleepHours = baselineSleepLogs.map((s) => s.totalHours);
  const hasBaseline = baselineSleepHours.length >= SLEEP_BASELINE_MIN_OBS;
  const sleepBaseline = hasBaseline ? median(baselineSleepHours) : null;

  // Sleep drop major: 2+ of last 3 days ≤ baseline - 1.5h
  const sleepDropMajor = hasBaseline && !coverage.sleepLowConfidence &&
    last3Sleep.filter((s) => s.totalHours <= sleepBaseline! - SLEEP_DROP_MAJOR_DELTA).length >= 2;

  // Short sleep streak: 3+ of last 5 days < 6h
  const shortSleepStreak = !coverage.sleepLowConfidence &&
    last5Sleep.filter((s) => s.totalHours < SHORT_SLEEP_HOURS).length >= 3;

  // Bedtime drift: 2+ of last 3 days with bedtime > 120min from baseline
  let bedtimeDrift = false;
  if (hasBaseline && !coverage.sleepLowConfidence) {
    const baselineBedtimes = baselineSleepLogs
      .filter((s) => s.bedtime)
      .map((s) => bedtimeToMinutes(s.bedtime!));
    if (baselineBedtimes.length >= SLEEP_BASELINE_MIN_OBS) {
      const bedtimeBaseline = median(baselineBedtimes);
      const recentDrifts = last3Sleep.filter((s) => {
        if (!s.bedtime) return false;
        const mins = bedtimeToMinutes(s.bedtime);
        const diff = Math.abs(mins - bedtimeBaseline);
        // Handle wraparound (e.g. 23:00 vs 01:00)
        const circularDiff = Math.min(diff, 1440 - diff);
        return circularDiff > BEDTIME_DRIFT_MINUTES;
      });
      bedtimeDrift = recentDrifts.length >= 2;
    }
  }

  // ── Mood features (2 of last 3 days) ─────────────────────────
  const lowMoodRecent = last3Entries.filter((e) => e.mood <= 2).length >= 2;
  const highEnergyRecent = last3Entries.filter((e) => e.energyLevel !== null && e.energyLevel >= 4).length >= 2;
  const highAnxietyRecent = last3Entries.filter((e) => e.anxietyLevel !== null && e.anxietyLevel >= 4).length >= 2;
  const highIrritabilityRecent = last3Entries.filter((e) => e.irritability !== null && e.irritability >= 4).length >= 2;

  // ── Warning sign clusters (last 3 days, weighted) ─────────────
  let maniaWeightedSum = 0;
  let depressionWeightedSum = 0;
  for (const e of last3Entries) {
    const signs = parseStringArray(e.warningSigns);
    for (const s of signs) {
      // Default salience = 1 for all signs (user personalization would override)
      const salience = 1 as keyof typeof SALIENCE_WEIGHTS;
      const weight = SALIENCE_WEIGHTS[salience];
      if (DEFAULT_MANIA_SIGNS.has(s)) maniaWeightedSum += weight;
      if (DEFAULT_DEPRESSION_SIGNS.has(s)) depressionWeightedSum += weight;
    }
  }
  const maniaWarningCluster = maniaWeightedSum >= WARNING_CLUSTER_THRESHOLD;
  const depressionWarningCluster = depressionWeightedSum >= WARNING_CLUSTER_THRESHOLD;

  // ── Medication adherence ──────────────────────────────────────
  const criticalMeds = medications.filter(
    (m) => m.riskRole === "mood_stabilizer" || m.riskRole === "antipsychotic",
  );
  const medNonAdherenceMajor = criticalMeds.length > 0 && criticalMeds.some(
    (m) => m.adherence7d < MED_NONADHERENCE_THRESHOLD || m.consecutiveMissed >= MED_CONSECUTIVE_MISSED_THRESHOLD,
  );

  // ── Spending features ─────────────────────────────────────────
  const { spendingCandidate, spendingMateriality, sameDayActivationCorroborator: spendActivation, spendLowConf } =
    computeSpendingFeatures(financialTxs, now, tz, {
      sleepDropMajor,
      shortSleepStreak,
      highEnergyRecent,
      highIrritabilityRecent,
      maniaWarningCluster,
    });
  coverage.spendLowConfidence = spendLowConf;

  // ── Scales ────────────────────────────────────────────────────
  const scalesFresh = !coverage.scalesStale;
  const latestAsrmTotal = latestWeekly?.asrmTotal ?? null;
  const latestPhq9Total = latestWeekly?.phq9Total ?? null;
  const latestPhq9Item9 = latestWeekly?.phq9Item9 ?? null;
  const sameAssessmentWindow = true; // ASRM and PHQ-9 come from same weekly assessment

  // ── Safety features ───────────────────────────────────────────
  const todayHasSuicidalWarningSign = todayWarningSigns.includes("pensamentos_suicidas");

  const safetyScreenRequired =
    todayHasSuicidalWarningSign ||
    (latestPhq9Item9 !== null && latestPhq9Item9 >= 1 && !latestSafetyScreen?.completedAt) ||
    false;

  const safetyScreenCompleted = !!latestSafetyScreen?.completedAt;

  let latestAsq: AsqResult | null = null;
  let latestBssa: BssaResult | null = null;
  if (latestSafetyScreen?.completedAt) {
    if (latestSafetyScreen.asq) {
      try { latestAsq = JSON.parse(latestSafetyScreen.asq); } catch { /* */ }
    }
    if (latestSafetyScreen.bssa) {
      try { latestBssa = JSON.parse(latestSafetyScreen.bssa); } catch { /* */ }
    }
  }

  // ── Activation corroborators ──────────────────────────────────
  const activationCorroborators = [
    sleepDropMajor || shortSleepStreak,
    highEnergyRecent,
    highIrritabilityRecent,
    maniaWarningCluster,
    spendingMateriality,
  ].filter(Boolean).length;

  const distressCorroborators = [
    lowMoodRecent,
    highAnxietyRecent,
    depressionWarningCluster,
    latestPhq9Total !== null && latestPhq9Total >= PHQ9_SEVERE_CUTOFF,
  ].filter(Boolean).length;

  // ── Syndrome: Mixed state ─────────────────────────────────────
  const freshAsrmHypomaniaLikely = scalesFresh && latestAsrmTotal !== null && latestAsrmTotal >= ASRM_HYPOMANIA_CUTOFF;
  const freshPhqModerate = scalesFresh && latestPhq9Total !== null && latestPhq9Total >= PHQ9_MODERATE_CUTOFF;

  const mixedCore = freshAsrmHypomaniaLikely && freshPhqModerate && sameAssessmentWindow;
  const mixedOrange = mixedCore && activationCorroborators >= 2 && distressCorroborators >= 1;
  const mixedYellow = mixedCore && !mixedOrange;

  // ── Syndrome: Mania ───────────────────────────────────────────
  const maniaActivationCount = activationCorroborators;
  const maniaOrange = scalesFresh && latestAsrmTotal !== null && latestAsrmTotal >= ASRM_HYPOMANIA_CUTOFF &&
    maniaActivationCount >= 2 && (sleepDropMajor || maniaWarningCluster || spendingMateriality);
  const maniaYellow = !maniaOrange && (
    (scalesFresh && latestAsrmTotal !== null && latestAsrmTotal >= ASRM_HYPOMANIA_CUTOFF && maniaActivationCount < 2) ||
    (scalesFresh && latestAsrmTotal !== null && latestAsrmTotal >= ASRM_ACTIVATION_CUTOFF && maniaActivationCount >= 2)
  );

  // ── Syndrome: Severe mania (psychiatric emergency without suicidality) ──
  // ASRM ≥ 11 + ≥3 corroborators + dangerous warning signs (agitation, disinhibition, psychotic features)
  const dangerousManiaSigns = todayWarningSigns.some((s) =>
    s === "agitacao" || s === "desinibicao" || s === "planos_grandiosos" || s === "agressividade" ||
    s === "psicose" || s === "alucinacoes" || s === "delirios" || s === "incapacidade_autocuidado",
  );
  const severeManiaAcute = scalesFresh &&
    latestAsrmTotal !== null && latestAsrmTotal >= ASRM_SEVERE_MANIA_CUTOFF &&
    activationCorroborators >= SEVERE_MANIA_MIN_CORROBORATORS &&
    (dangerousManiaSigns || (sleepDropMajor && shortSleepStreak));

  // ── Syndrome: Depression ──────────────────────────────────────
  const depressionOrange = scalesFresh && latestPhq9Total !== null && (
    latestPhq9Total >= PHQ9_SEVERE_CUTOFF ||
    (latestPhq9Total >= PHQ9_MODERATE_CUTOFF && lowMoodRecent && (highAnxietyRecent || depressionWarningCluster))
  );
  const depressionYellow = !depressionOrange && (
    (scalesFresh && latestPhq9Total !== null && latestPhq9Total >= PHQ9_MODERATE_CUTOFF) ||
    lowMoodRecent
  );

  // ── Prodrome ──────────────────────────────────────────────────
  const prodromeMajorCount = [
    sleepDropMajor,
    shortSleepStreak,
    maniaWarningCluster,
    depressionWarningCluster,
    spendingMateriality,
    medNonAdherenceMajor,
  ].filter(Boolean).length;

  const prodromeMinorCount = [
    bedtimeDrift,
    highEnergyRecent,
    highIrritabilityRecent,
    lowMoodRecent,
    highAnxietyRecent,
  ].filter(Boolean).length;

  const prodromeHasCrossDomain = (sleepDropMajor || shortSleepStreak || lowMoodRecent || highEnergyRecent) &&
    (maniaWarningCluster || depressionWarningCluster || spendingMateriality || medNonAdherenceMajor);

  const prodromeOrange = prodromeMajorCount >= 2 && prodromeHasCrossDomain;
  const prodromeYellow = !prodromeOrange && (prodromeMajorCount >= 1 || prodromeMinorCount >= 2);

  return {
    sleepDropMajor,
    shortSleepStreak,
    bedtimeDrift,
    lowMoodRecent,
    highEnergyRecent,
    highAnxietyRecent,
    highIrritabilityRecent,
    maniaWarningCluster,
    depressionWarningCluster,
    medNonAdherenceMajor,
    spendingCandidate,
    spendingMateriality,
    sameDayActivationCorroborator: spendActivation,
    latestAsrmTotal,
    latestPhq9Total,
    latestPhq9Item9,
    scalesFresh,
    sameAssessmentWindow,
    todayHasSuicidalWarningSign,
    safetyScreenRequired,
    safetyScreenCompleted,
    latestAsq,
    latestBssa,
    mixedCore,
    mixedOrange,
    mixedYellow,
    maniaOrange,
    maniaYellow,
    depressionOrange,
    depressionYellow,
    severeManiaAcute,
    prodromeMajorCount,
    prodromeMinorCount,
    prodromeOrange,
    prodromeYellow,
    activationCorroborators,
    distressCorroborators,
    coverage,
  };
}

// ── Spending computation (private) ───────────────────────────────

function computeSpendingFeatures(
  txs: FinancialTxInput[],
  now: Date,
  tz: string,
  context: {
    sleepDropMajor: boolean;
    shortSleepStreak: boolean;
    highEnergyRecent: boolean;
    highIrritabilityRecent: boolean;
    maniaWarningCluster: boolean;
  },
): {
  spendingCandidate: boolean;
  spendingMateriality: boolean;
  sameDayActivationCorroborator: boolean;
  spendLowConf: boolean;
} {
  const todayStr = dateStr(now, tz);
  const baselineEnd = new Date(now);
  baselineEnd.setDate(baselineEnd.getDate() - SPEND_BASELINE_EXCLUDE_RECENT_DAYS);
  const baselineStart = new Date(now);
  baselineStart.setDate(baselineStart.getDate() - SPEND_BASELINE_WINDOW_DAYS);
  const baselineStartStr = dateStr(baselineStart, tz);
  const baselineEndStr = dateStr(baselineEnd, tz);
  const d7Ago = new Date(now); d7Ago.setDate(d7Ago.getDate() - 6);
  const str7 = dateStr(d7Ago, tz);

  // Filter to discretionary expenses only
  const isDiscretionary = (tx: FinancialTxInput): boolean => {
    if (tx.amount >= 0) return false; // income/credit
    const cat = (tx.category || "").toLowerCase().trim();
    const desc = (tx.description || "").toLowerCase().trim();
    return !ESSENTIAL_CATEGORIES.has(cat) && ![...ESSENTIAL_CATEGORIES].some((e) => desc.includes(e));
  };

  // Daily discretionary spend
  const dailySpend: Record<string, number> = {};
  for (const tx of txs) {
    if (!isDiscretionary(tx)) continue;
    if (!dailySpend[tx.date]) dailySpend[tx.date] = 0;
    dailySpend[tx.date] += Math.abs(tx.amount);
  }

  // Baseline
  const baselineDays = Object.entries(dailySpend)
    .filter(([d]) => d >= baselineStartStr && d < baselineEndStr)
    .map(([, v]) => v);

  const uniqueBaselineDates = new Set(
    Object.keys(dailySpend).filter((d) => d >= baselineStartStr && d < baselineEndStr),
  );

  const spendLowConf = baselineDays.length < SPEND_BASELINE_MIN_TXNS ||
    uniqueBaselineDates.size < SPEND_BASELINE_MIN_DAYS;

  if (spendLowConf) {
    return { spendingCandidate: false, spendingMateriality: false, sameDayActivationCorroborator: false, spendLowConf };
  }

  const medSpend = median(baselineDays);
  const madSpend = mad(baselineDays);
  const p90Spend = percentile(baselineDays, 90);

  // Check recent days for spending anomalies
  const recentDays = Object.entries(dailySpend).filter(([d]) => d >= str7);
  let spendingCandidate = false;
  let spendingMateriality = false;
  let sameDayActivationCorroborator = false;

  const candidateDays = recentDays.filter(
    ([, val]) => val > p90Spend && robustZ(val, medSpend, madSpend) >= SPEND_ROBUST_Z_THRESHOLD,
  );

  if (candidateDays.length > 0) {
    spendingCandidate = true;

    const hasActivation = context.sleepDropMajor || context.shortSleepStreak ||
      context.highEnergyRecent || context.highIrritabilityRecent || context.maniaWarningCluster;
    sameDayActivationCorroborator = hasActivation;

    // Materiality check
    const repeatedCandidate = candidateDays.length >= 2;
    const anyDoubleMedian = candidateDays.some(([, val]) => val >= 2 * medSpend);

    spendingMateriality = repeatedCandidate || anyDoubleMedian || sameDayActivationCorroborator;
  }

  return { spendingCandidate, spendingMateriality, sameDayActivationCorroborator, spendLowConf };
}
