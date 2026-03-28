/**
 * Projects multiple MoodSnapshots into DiaryEntry aggregate fields.
 * Strategy: latest snapshot wins for mood/energy/anxiety/irritability.
 * Metadata: range, peaks, instability, delta, abrupt shifts, risk scores.
 */

export const AGGREGATION_VERSION = 1;

interface SnapshotInput {
  capturedAt: Date;
  feeling: number | null;
  mood: number;
  energy: number;
  anxiety: number | null;
  irritability: number | null;
  warningSignsNow: string | null;
  note: string | null;
}

interface ProjectionResult {
  // Latest values (for DiaryEntry fields)
  feeling: number | null;
  mood: number;
  energyLevel: number;
  anxietyLevel: number | null;
  irritability: number | null;
  warningSigns: string | null;
  note: string | null;

  // Metadata
  snapshotCount: number;
  firstSnapshotAt: Date;
  lastSnapshotAt: Date;
  moodRange: number;
  moodInstability: number | null;
  anxietyPeak: number | null;
  irritabilityPeak: number | null;
  morningEveningDelta: number | null;
  abruptShifts: number;
  aggregationVersion: number;

  // Risk scores
  riskScoreCurrent: number;
  riskScorePeak: number;
}

const RISK_WARNING_SIGNS = [
  "pensamentos_acelerados",
  "gastos_impulsivos",
  "energia_excessiva",
  "planos_grandiosos",
  "irritabilidade_extrema",
  "pensamentos_negativos",
  "isolamento",
];

/** Lightweight per-snapshot risk heuristic (0-based, higher = more risk) */
function snapshotRisk(s: SnapshotInput): number {
  let r = 0;
  if (s.mood >= 5) r += 2;       // extreme high (mania indicator)
  if (s.mood <= 1) r += 2;       // extreme low (depression indicator)
  if ((s.anxiety ?? 0) >= 4) r += 1;
  if ((s.irritability ?? 0) >= 4) r += 1;
  if (s.energy >= 5) r += 1;     // manic energy
  if (s.energy <= 1) r += 1;     // lethargy

  // Mixed state indicator: high energy + extreme mood on either end
  if (s.energy >= 4 && (s.mood <= 2 || (s.irritability ?? 0) >= 4)) r += 1;

  if (s.warningSignsNow) {
    try {
      const signs = JSON.parse(s.warningSignsNow);
      if (Array.isArray(signs)) {
        const matched = signs.filter((sign: string) => RISK_WARNING_SIGNS.includes(sign)).length;
        if (matched >= 2) r += 1;
        if (matched >= 4) r += 1;
      }
    } catch { /* ignore */ }
  }
  return r;
}

export function projectSnapshots(snapshots: SnapshotInput[]): ProjectionResult | null {
  if (snapshots.length === 0) return null;

  // Filter out corrupted entries: each snapshot must have a valid capturedAt
  // and numeric fields. One bad entry must not break the whole projection.
  const safe: SnapshotInput[] = [];
  for (const s of snapshots) {
    try {
      // Validate capturedAt is a real Date
      if (!(s.capturedAt instanceof Date) || isNaN(s.capturedAt.getTime())) continue;
      // Validate numeric fields exist
      if (typeof s.mood !== "number" || typeof s.energy !== "number") continue;
      // anxiety/irritability are optional in quick check-in mode
      safe.push(s);
    } catch {
      // Skip corrupted entry
    }
  }
  if (safe.length === 0) return null;

  // Sort by capturedAt ascending
  const sorted = [...safe].sort(
    (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime(),
  );

  const latest = sorted[sorted.length - 1];
  const first = sorted[0];

  // Mood range
  const moods = sorted.map((s) => s.mood);
  const moodRange = Math.max(...moods) - Math.min(...moods);

  // Mood instability: mean absolute successive difference (MASD)
  let moodInstability: number | null = null;
  if (sorted.length >= 2) {
    let totalDiff = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalDiff += Math.abs(sorted[i].mood - sorted[i - 1].mood);
    }
    moodInstability = Math.round((totalDiff / (sorted.length - 1)) * 100) / 100;
  }

  // Morning-evening delta (last - first mood)
  const morningEveningDelta = sorted.length >= 2 ? latest.mood - first.mood : null;

  // Abrupt shifts: count of mood changes >= 2 points between successive snapshots
  let abruptShifts = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].mood - sorted[i - 1].mood) >= 2) {
      abruptShifts++;
    }
  }

  // Peaks
  const anxietyValues = sorted.map((s) => s.anxiety).filter((v): v is number => v !== null);
  const irritabilityValues = sorted.map((s) => s.irritability).filter((v): v is number => v !== null);
  const anxietyPeak = anxietyValues.length > 0 ? Math.max(...anxietyValues) : null;
  const irritabilityPeak = irritabilityValues.length > 0 ? Math.max(...irritabilityValues) : null;

  // Warning signs: union of all unique signs
  const allSigns = new Set<string>();
  for (const s of sorted) {
    if (s.warningSignsNow) {
      try {
        const signs = JSON.parse(s.warningSignsNow);
        if (Array.isArray(signs)) {
          signs.forEach((sign: string) => allSigns.add(sign));
        }
      } catch { /* ignore malformed */ }
    }
  }
  const warningSigns = allSigns.size > 0 ? JSON.stringify([...allSigns]) : null;

  // Latest non-null note
  const note = [...sorted].reverse().find((s) => s.note)?.note ?? null;

  // Risk scores (guarded: sorted.length >= 1 guaranteed here, but defensive for reuse)
  const riskScores = sorted.map((s) => snapshotRisk(s));
  const riskScoreCurrent = snapshotRisk(latest);
  const riskScorePeak = riskScores.length > 0 ? Math.max(...riskScores) : 0;

  return {
    feeling: latest.feeling ?? null,
    mood: latest.mood,
    energyLevel: latest.energy,
    anxietyLevel: latest.anxiety ?? null,
    irritability: latest.irritability ?? null,
    warningSigns,
    note,
    snapshotCount: sorted.length,
    firstSnapshotAt: first.capturedAt,
    lastSnapshotAt: latest.capturedAt,
    moodRange,
    moodInstability,
    anxietyPeak: anxietyPeak ?? null,
    irritabilityPeak: irritabilityPeak ?? null,
    morningEveningDelta,
    abruptShifts,
    aggregationVersion: AGGREGATION_VERSION,
    riskScoreCurrent,
    riskScorePeak,
  };
}

export { type SnapshotInput, type ProjectionResult };
