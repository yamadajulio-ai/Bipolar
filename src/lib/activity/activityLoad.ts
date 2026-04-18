/**
 * Activity-load computation (ADR-011 Movimento e Ritmo).
 *
 * We compute a single scalar `activityLoad` per day that combines intensity
 * and duration. GPT Pro specified: Σ (intensityWeight × durationMin) plus a
 * lateness bonus when a session ends close to habitual sleep time. This is
 * the canonical metric used by the risk engine and shadow-mode baseline.
 */

export type IntensityBand = "light" | "moderate" | "vigorous";

export interface ActivitySessionInput {
  localDate: string;
  startAtUtc: Date;
  endAtUtc: Date;
  durationSec: number;
  intensityBand?: IntensityBand;
  activityTypeNorm: string;
  avgHr?: number;
}

const INTENSITY_WEIGHT: Record<IntensityBand, number> = {
  light: 1,
  moderate: 2,
  vigorous: 3,
};

// Minutes before habitual sleep that count as "late" (window of concern).
// 240min = 4h — matches GPT Pro threshold for lateSessionMinutes.
export const LATE_WINDOW_MIN = 240;

// Additive bonus per minute of late intensity. Deliberately small relative
// to the base load so that a normal evening walk does not dominate.
const LATE_BONUS_PER_MIN = 0.5;

/**
 * Compute activityLoad for a single day given sessions and habitual sleep time.
 *
 * `habitualSleepLocalMinutes` is the user's typical bedtime in minutes after
 * midnight (e.g. 23:30 = 1410). If unknown, the lateness bonus is skipped —
 * conservative, avoids false positives before the baseline stabilizes.
 */
export function computeDailyActivityLoad(
  sessions: ActivitySessionInput[],
  habitualSleepLocalMinutes: number | null,
): {
  activityLoad: number;
  sessionMinutesLight: number;
  sessionMinutesModerate: number;
  sessionMinutesVigorous: number;
  lateSessionMinutes: number;
  lastSessionEndRelativeToHabitualSleepMin: number | null;
} {
  let load = 0;
  let minLight = 0;
  let minModerate = 0;
  let minVigorous = 0;
  let lateMin = 0;
  let lastEndRelative: number | null = null;

  for (const s of sessions) {
    const band: IntensityBand = s.intensityBand ?? "moderate";
    const durMin = s.durationSec / 60;
    const weight = INTENSITY_WEIGHT[band];
    load += weight * durMin;

    if (band === "light") minLight += Math.round(durMin);
    else if (band === "moderate") minModerate += Math.round(durMin);
    else minVigorous += Math.round(durMin);

    // Lateness: only penalize moderate/vigorous. Light activity (walk, yoga)
    // near bedtime is not a clinical concern.
    if (habitualSleepLocalMinutes !== null && band !== "light") {
      const endLocalMin = endLocalMinutesFromUtc(s.endAtUtc);
      const minutesBeforeSleep = habitualSleepLocalMinutes - endLocalMin;
      if (minutesBeforeSleep >= 0 && minutesBeforeSleep < LATE_WINDOW_MIN) {
        // The closer to bedtime, the heavier. Linear ramp inside the window.
        const proximity = 1 - minutesBeforeSleep / LATE_WINDOW_MIN;
        const minutesOfLate = Math.min(durMin, LATE_WINDOW_MIN - minutesBeforeSleep);
        lateMin += Math.round(minutesOfLate);
        load += LATE_BONUS_PER_MIN * minutesOfLate * proximity * weight;
      }

      if (lastEndRelative === null || minutesBeforeSleep < lastEndRelative) {
        lastEndRelative = -minutesBeforeSleep;
      }
    }
  }

  return {
    activityLoad: round2(load),
    sessionMinutesLight: minLight,
    sessionMinutesModerate: minModerate,
    sessionMinutesVigorous: minVigorous,
    lateSessionMinutes: lateMin,
    lastSessionEndRelativeToHabitualSleepMin: lastEndRelative,
  };
}

// Minutes past midnight for a Date in the canonical America/Sao_Paulo TZ.
// Uses Swedish locale for stable YYYY-MM-DD HH:MM parsing.
function endLocalMinutesFromUtc(utc: Date): number {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utc);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
