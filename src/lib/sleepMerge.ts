/**
 * Sleep data merge logic.
 *
 * Merge rule — when manual and wearable data overlap for the same session:
 *   Timing  (bedtime, wakeTime, totalHours) → wearable wins (sensor-precise)
 *   Biometrics (awakeMinutes, HRV, HR)      → wearable wins (sensor-only)
 *   Awakenings                              → wearable wins if it has stage data
 *   Subjective (quality, preRoutine, notes) → manual wins (human-only)
 *   excluded                                → preserve existing (user decision)
 *   source                                  → set by caller
 */

/** Convert "HH:MM" to minutes since midnight */
export function bedtimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Check if two bedtimes are within `thresholdMin` of each other (handles midnight crossing) */
export function bedtimesOverlap(a: string, b: string, thresholdMin = 30): boolean {
  const aMin = bedtimeToMinutes(a);
  const bMin = bedtimeToMinutes(b);
  let diff = Math.abs(aMin - bMin);
  if (diff > 720) diff = 1440 - diff; // midnight crossing
  return diff <= thresholdMin;
}

/** Fields that only a wearable can provide (objective) */
export interface WearableFields {
  awakeMinutes?: number;
  hrv?: number | null;
  heartRate?: number | null;
  awakenings?: number;
}

/** Fields that only a human can provide (subjective) */
export interface ManualFields {
  quality?: number;
  preRoutine?: string | null;
  notes?: string | null;
}

/**
 * When a MANUAL entry merges into an existing WEARABLE record:
 * - Keep wearable's awakeMinutes (manual form doesn't capture this)
 * - Keep wearable's HRV/HR unless manual explicitly provided them
 * - Manual wins on quality, preRoutine, notes
 */
export function mergeManualIntoWearable(
  manualData: Record<string, unknown>,
  existingWearable: {
    awakeMinutes: number;
    hrv: number | null;
    heartRate: number | null;
  },
): Record<string, unknown> {
  const merged = { ...manualData };

  // Preserve wearable's awakeMinutes (manual never sends this)
  merged.awakeMinutes = existingWearable.awakeMinutes;

  // Keep wearable HRV/HR if manual didn't explicitly provide them
  if (manualData.hrv === null || manualData.hrv === undefined) {
    merged.hrv = existingWearable.hrv;
  }
  if (manualData.heartRate === null || manualData.heartRate === undefined) {
    merged.heartRate = existingWearable.heartRate;
  }

  return merged;
}

/**
 * When a WEARABLE entry merges into an existing MANUAL record:
 * - Wearable wins on timing, awakeMinutes, HRV, HR
 * - Preserve manual's quality (unless wearable has stage-derived quality), preRoutine, notes
 */
export function mergeWearableIntoManual(
  wearableData: Record<string, unknown>,
  existingManual: {
    quality: number;
    preRoutine: string | null;
    notes: string | null;
    excluded: boolean;
  },
  wearableHasStages: boolean,
): Record<string, unknown> {
  const merged = { ...wearableData };

  // Preserve manual subjective data
  if (!wearableHasStages) {
    merged.quality = existingManual.quality;
  }
  merged.preRoutine = existingManual.preRoutine;
  merged.notes = existingManual.notes;
  merged.excluded = existingManual.excluded;

  return merged;
}
