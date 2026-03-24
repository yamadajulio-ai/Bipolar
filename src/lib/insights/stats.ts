// ── Shared statistical helpers ─────────────────────────────────

/** Parse HH:MM time string to minutes since midnight. Returns null on invalid input. */
export function timeToMinutes(time: string): number | null {
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Normalize bedtime minutes so post-midnight (00:00-11:59) becomes +1440. */
export function normalizeBedtime(mins: number): number {
  return mins < 720 ? mins + 1440 : mins;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Sample standard deviation (n-1 denominator for small samples). */
export function computeStdDev(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance));
}

export function formatSleepDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function minutesToTime(mins: number): string {
  const total = Math.round(((mins % 1440) + 1440) % 1440); // integer 0..1439
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function dateStr(d: Date, tz: string): string {
  const parts = d.toLocaleDateString("sv-SE", { timeZone: tz }).split("-");
  return parts.join("-");
}

/** Safely parse a JSON string that should be string[]. Returns [] on any error. */
export function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Check if two YYYY-MM-DD dates are exactly 1 day apart. */
export function isNextDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + "T12:00:00Z");
  const b = new Date(dateB + "T12:00:00Z");
  const diffMs = b.getTime() - a.getTime();
  return diffMs >= 23 * 3600000 && diffMs <= 25 * 3600000;
}

/** Current streak ending at the last element — for active alerts. */
export function currentStreak<T extends { date: string }>(
  sorted: T[],
  predicate: (item: T) => boolean,
): number {
  let cur = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!predicate(sorted[i])) break;
    if (i < sorted.length - 1 && !isNextDay(sorted[i].date, sorted[i + 1].date)) break;
    cur++;
  }
  return cur;
}

/**
 * Identify "main sleep" vs afternoon nap for risk scoring.
 * Afternoon/evening naps (< 4h, bedtime 12:00–19:59) are excluded because
 * wearables record them as sleep sessions that skew risk calculations.
 */
export function isMainSleep(log: { totalHours: number; bedtime: string }): boolean {
  if (log.totalHours >= 4) return true;
  const btMin = timeToMinutes(log.bedtime);
  if (btMin === null) return true; // Can't determine, assume main sleep
  // Bedtime between 12:00 (720) and 19:59 (1199) = likely afternoon nap
  if (btMin >= 720 && btMin < 1200) return false;
  return true;
}

/** Helper: get date string for day offset from a base date */
export function dayOffset(base: Date, offset: number, tz: string): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return dateStr(d, tz);
}

/** Aggregate multiple sleep cycles per day into one record per day.
 *  Sums totalHours/awakenings, averages quality/HRV/HR, keeps earliest bedtime + latest wakeTime. */
export function aggregateSleepByDay<T extends { date: string; bedtime: string; wakeTime: string; totalHours: number; quality: number; awakenings: number; hrv?: number | null; heartRate?: number | null }>(logs: T[]): T[] {
  const byDate = new Map<string, T[]>();
  for (const l of logs) {
    const arr = byDate.get(l.date) ?? [];
    arr.push(l);
    byDate.set(l.date, arr);
  }
  const result: T[] = [];
  for (const [, dayLogs] of byDate) {
    if (dayLogs.length === 1) {
      result.push(dayLogs[0]);
      continue;
    }
    // Merge: sum durations, earliest bedtime, latest wakeTime
    const merged = { ...dayLogs[0] };
    merged.totalHours = dayLogs.reduce((s, l) => s + l.totalHours, 0);
    merged.awakenings = dayLogs.reduce((s, l) => s + l.awakenings, 0);
    // Earliest bedtime (normalized for midnight crossing)
    merged.bedtime = dayLogs.reduce((best, l) => {
      const bMin = timeToMinutes(l.bedtime);
      const bestMin = timeToMinutes(best);
      if (bMin === null) return best;
      if (bestMin === null) return l.bedtime;
      return normalizeBedtime(bMin) < normalizeBedtime(bestMin) ? l.bedtime : best;
    }, dayLogs[0].bedtime);
    // Latest wakeTime
    merged.wakeTime = dayLogs.reduce((best, l) => l.wakeTime > best ? l.wakeTime : best, dayLogs[0].wakeTime);
    // Average quality (weighted by duration)
    const totalDur = dayLogs.reduce((s, l) => s + l.totalHours, 0);
    merged.quality = totalDur > 0
      ? Math.round(dayLogs.reduce((s, l) => s + l.quality * l.totalHours, 0) / totalDur)
      : dayLogs[0].quality;
    // Average HRV/HR from non-null values
    const hrvs = dayLogs.map((l) => l.hrv).filter((v): v is number => v != null);
    (merged as Record<string, unknown>).hrv = hrvs.length > 0 ? Math.round(hrvs.reduce((a, b) => a + b, 0) / hrvs.length) : null;
    const hrs = dayLogs.map((l) => l.heartRate).filter((v): v is number => v != null);
    (merged as Record<string, unknown>).heartRate = hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null;
    result.push(merged);
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** MAD-based sigma calculation (used by risk score and spending-mood). */
export function computeMADSigma(values: number[]): { median: number; sigma: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const devs = values.map((x) => Math.abs(x - med));
  const devsSorted = [...devs].sort((a, b) => a - b);
  const madMid = Math.floor(devsSorted.length / 2);
  const madVal = devsSorted.length % 2 !== 0 ? devsSorted[madMid] : (devsSorted[madMid - 1] + devsSorted[madMid]) / 2;

  let sigma: number;
  if (madVal > 0) {
    sigma = madVal * 1.4826;
  } else {
    // Fallback: MAD = 0 (most values are identical).
    // Fall back to mean absolute deviation from median.
    const meanDev = devs.reduce((a, b) => a + b, 0) / devs.length;
    sigma = meanDev > 0 ? meanDev : 0;
  }

  return { median: med, sigma };
}

/** Convert variance to regularity score 10-100.
 *  ≤30min = 100 (very regular), ≥240min = 10 (very irregular).
 *  Floor of 10 ensures users who sleep regularly get credit even with high variance. */
export function regularityScoreFromVariance(v: number): number {
  if (v <= 30) return 100;
  if (v >= 240) return 10;
  return Math.round(10 + 90 * (1 - (v - 30) / 210));
}
