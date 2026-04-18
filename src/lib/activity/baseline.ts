/**
 * Personal baseline and anomaly detection (ADR-011 Movimento e Ritmo).
 *
 * 28-day rolling baseline using median + MAD (Median Absolute Deviation).
 * Per GPT Pro: MAD is robust to outliers, unlike mean + SD which would be
 * contaminated by a single big weekend workout. We also segment weekday vs
 * weekend to avoid false positives from Saturday/Sunday activity spikes.
 */

export interface DailyLoadPoint {
  localDate: string;          // YYYY-MM-DD
  activityLoad: number;
  dataCompleteness: number;   // 0..1 — excluded from baseline if too low
  dayOfWeek: number;          // 0..6, 0=Sunday, 6=Saturday (America/Sao_Paulo)
}

export interface BaselineResult {
  baseline28d: number | null;
  baseline28dMad: number | null;
  weekendAdjustedBaseline: number | null;
  zScore: number | null;           // robust z-score vs weekend-adjusted baseline
  sampleSize: number;
}

// Minimum completeness to include a day in baseline computation. Below this,
// the day is dropped so "didn't wear watch" doesn't drag the baseline down.
const MIN_COMPLETENESS_FOR_BASELINE = 0.5;

// Minimum days needed before we emit a baseline. Below this we return nulls,
// shadow mode still runs but risk engine must not fire without a baseline.
const MIN_DAYS_FOR_BASELINE = 14;

/**
 * Compute 28-day baseline from today's vantage point.
 *
 * @param history points from the last 28 days (today excluded)
 * @param today current day's data point (optional — used for zScore)
 */
export function computeBaseline28d(
  history: DailyLoadPoint[],
  today?: DailyLoadPoint,
): BaselineResult {
  const eligible = history.filter(
    (p) => p.dataCompleteness >= MIN_COMPLETENESS_FOR_BASELINE,
  );

  if (eligible.length < MIN_DAYS_FOR_BASELINE) {
    return {
      baseline28d: null,
      baseline28dMad: null,
      weekendAdjustedBaseline: null,
      zScore: null,
      sampleSize: eligible.length,
    };
  }

  const loads = eligible.map((p) => p.activityLoad);
  const med = median(loads);
  const mad = medianAbsoluteDeviation(loads, med);

  // Weekend segmentation: if today is weekend, compare to weekend baseline.
  let weekendAdjusted = med;
  if (today) {
    const isWeekend = today.dayOfWeek === 0 || today.dayOfWeek === 6;
    const sameKind = eligible.filter((p) => {
      const w = p.dayOfWeek === 0 || p.dayOfWeek === 6;
      return isWeekend ? w : !w;
    });
    if (sameKind.length >= 4) {
      weekendAdjusted = median(sameKind.map((p) => p.activityLoad));
    }
  }

  let zScore: number | null = null;
  if (today && mad > 0) {
    // Robust z via MAD: 1.4826 is the constant that makes MAD consistent with SD for normals.
    zScore = round3((today.activityLoad - weekendAdjusted) / (1.4826 * mad));
  } else if (today && mad === 0) {
    // Degenerate case: all baseline days have the same load (rare, e.g. all zeros).
    zScore = today.activityLoad > weekendAdjusted ? 3 : 0;
  }

  return {
    baseline28d: round2(med),
    baseline28dMad: round2(mad),
    weekendAdjustedBaseline: round2(weekendAdjusted),
    zScore,
    sampleSize: eligible.length,
  };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function medianAbsoluteDeviation(arr: number[], med: number): number {
  const deviations = arr.map((x) => Math.abs(x - med));
  return median(deviations);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
