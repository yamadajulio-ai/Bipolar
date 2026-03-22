/**
 * Projects multiple MoodSnapshots into DiaryEntry aggregate fields.
 * Strategy: latest snapshot wins for mood/energy/anxiety/irritability.
 * Metadata: range, peaks, instability (mean absolute successive difference).
 */

interface SnapshotInput {
  capturedAt: Date;
  mood: number;
  energy: number;
  anxiety: number;
  irritability: number;
  warningSignsNow: string | null;
  note: string | null;
}

interface ProjectionResult {
  // Latest values (for DiaryEntry fields)
  mood: number;
  energyLevel: number;
  anxietyLevel: number;
  irritability: number;
  warningSigns: string | null; // union of all warning signs as JSON
  note: string | null; // latest non-null note

  // Metadata
  snapshotCount: number;
  firstSnapshotAt: Date;
  lastSnapshotAt: Date;
  moodRange: number;
  moodInstability: number | null; // null if only 1 snapshot
  anxietyPeak: number;
  irritabilityPeak: number;
}

export function projectSnapshots(snapshots: SnapshotInput[]): ProjectionResult | null {
  if (snapshots.length === 0) return null;

  // Sort by capturedAt ascending
  const sorted = [...snapshots].sort(
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

  // Peaks
  const anxietyPeak = Math.max(...sorted.map((s) => s.anxiety));
  const irritabilityPeak = Math.max(...sorted.map((s) => s.irritability));

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

  return {
    mood: latest.mood,
    energyLevel: latest.energy,
    anxietyLevel: latest.anxiety,
    irritability: latest.irritability,
    warningSigns,
    note,
    snapshotCount: sorted.length,
    firstSnapshotAt: first.capturedAt,
    lastSnapshotAt: latest.capturedAt,
    moodRange,
    moodInstability,
    anxietyPeak,
    irritabilityPeak,
  };
}
