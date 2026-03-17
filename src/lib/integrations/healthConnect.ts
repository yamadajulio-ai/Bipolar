/**
 * Parser for Health Connect Webhook (Android) payloads.
 * Handles data from HC Webhook app (github.com/mcnaveen/health-connect-webhook)
 * and compatible apps like Life Dashboard Companion.
 *
 * Payload format:
 * {
 *   "timestamp": "2026-03-17T12:00:00Z",
 *   "app_version": "1.0",
 *   "sleep": [{ session_end_time, duration_seconds, stages: [{ stage, start_time, end_time, duration_seconds }] }],
 *   "steps": [{ count, start_time, end_time }],
 *   "heart_rate": [{ bpm, time }],
 *   "heart_rate_variability": [{ rmssd_millis, time }],
 *   "resting_heart_rate": [{ bpm, time }],
 *   "active_calories": [{ calories, start_time, end_time }],
 *   "oxygen_saturation": [{ percentage, time }],
 *   ...
 * }
 */

import type { ProcessedSleepNight, ProcessedGenericMetric } from "./healthExport";

// Re-export shared types
export type { ProcessedSleepNight, ProcessedGenericMetric };

export interface HealthConnectResult {
  sleepNights: ProcessedSleepNight[];
  genericMetrics: ProcessedGenericMetric[];
}

// ── Types for HC Webhook payload ────────────────────────────────

interface HCSleepStage {
  stage: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
}

interface HCSleep {
  session_end_time: string;
  duration_seconds: number;
  stages?: HCSleepStage[];
}

interface HCSteps {
  count: number;
  start_time: string;
  end_time: string;
}

interface HCHeartRate {
  bpm: number;
  time: string;
}

interface HCHRV {
  rmssd_millis: number;
  time: string;
}

interface HCRestingHR {
  bpm: number;
  time: string;
}

interface HCCalories {
  calories: number;
  start_time: string;
  end_time: string;
}

interface HCOxygenSaturation {
  percentage: number;
  time: string;
}

interface HCPayload {
  timestamp?: string;
  app_version?: string;
  sleep?: HCSleep[];
  steps?: HCSteps[];
  heart_rate?: HCHeartRate[];
  heart_rate_variability?: HCHRV[];
  resting_heart_rate?: HCRestingHR[];
  active_calories?: HCCalories[];
  oxygen_saturation?: HCOxygenSaturation[];
}

// ── Timezone helpers (same as healthExport.ts) ──────────────────

const USER_TZ = "America/Sao_Paulo";

function toYMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: USER_TZ }).format(d);
}

function formatHHMM(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: USER_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Sleep stage normalization ───────────────────────────────────
// Health Connect SDK stage types:
//   STAGE_TYPE_UNKNOWN=0, AWAKE=1, SLEEPING=2, OUT_OF_BED=3,
//   LIGHT=4, DEEP=5, REM=6, AWAKE_IN_BED=7

type SleepStageType = "light" | "deep" | "rem" | "awake" | "sleeping" | "unknown";

function normalizeStage(stage: string): SleepStageType {
  const s = stage.toLowerCase().replace(/[\s_-]/g, "");
  if (s.includes("deep") || s === "5" || s.includes("profundo")) return "deep";
  if (s.includes("rem") || s === "6") return "rem";
  if (s.includes("light") || s === "4" || s.includes("leve")) return "light";
  if (s.includes("awake") || s === "1" || s === "7") return "awake";
  if (s.includes("sleeping") || s === "2") return "sleeping";
  if (s.includes("outofbed") || s === "3") return "awake";
  return "unknown";
}

// ── Main parser ─────────────────────────────────────────────────

export function parseHealthConnectPayload(body: unknown): HealthConnectResult {
  const payload = body as HCPayload;
  const result: HealthConnectResult = {
    sleepNights: [],
    genericMetrics: [],
  };

  if (!payload || typeof payload !== "object") return result;

  // 1. Parse sleep sessions
  if (Array.isArray(payload.sleep)) {
    for (const session of payload.sleep) {
      const night = parseSleepSession(session, payload);
      if (night) result.sleepNights.push(night);
    }
  }

  // 2. Parse steps (aggregate per day)
  if (Array.isArray(payload.steps)) {
    const stepsByDay = new Map<string, number>();
    for (const step of payload.steps) {
      if (typeof step.count !== "number" || step.count <= 0) continue;
      // Use end_time for the day
      const d = new Date(step.end_time || step.start_time);
      if (isNaN(d.getTime())) continue;
      const day = toYMD(d);
      stepsByDay.set(day, (stepsByDay.get(day) ?? 0) + step.count);
    }
    for (const [date, value] of stepsByDay) {
      if (value > 0 && value < 200000) {
        result.genericMetrics.push({ date, metric: "steps", value, unit: "count" });
      }
    }
  }

  // 3. Parse active calories (aggregate per day)
  if (Array.isArray(payload.active_calories)) {
    const calsByDay = new Map<string, number>();
    for (const cal of payload.active_calories) {
      if (typeof cal.calories !== "number" || cal.calories <= 0) continue;
      const d = new Date(cal.end_time || cal.start_time);
      if (isNaN(d.getTime())) continue;
      const day = toYMD(d);
      calsByDay.set(day, (calsByDay.get(day) ?? 0) + cal.calories);
    }
    for (const [date, value] of calsByDay) {
      if (value > 0 && value < 10000) {
        result.genericMetrics.push({ date, metric: "active_calories", value: Math.round(value), unit: "kcal" });
      }
    }
  }

  // 4. Parse SpO2 (average per day)
  if (Array.isArray(payload.oxygen_saturation)) {
    const spo2ByDay = new Map<string, number[]>();
    for (const ox of payload.oxygen_saturation) {
      if (typeof ox.percentage !== "number" || ox.percentage < 50 || ox.percentage > 100) continue;
      const d = new Date(ox.time);
      if (isNaN(d.getTime())) continue;
      const day = toYMD(d);
      const arr = spo2ByDay.get(day) ?? [];
      arr.push(ox.percentage);
      spo2ByDay.set(day, arr);
    }
    for (const [date, values] of spo2ByDay) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      result.genericMetrics.push({ date, metric: "blood_oxygen", value: Math.round(avg * 10) / 10, unit: "%" });
    }
  }

  return result;
}

// ── Sleep session parser ────────────────────────────────────────

function parseSleepSession(
  session: HCSleep,
  payload: HCPayload,
): ProcessedSleepNight | null {
  if (!session.session_end_time || typeof session.duration_seconds !== "number") return null;

  const totalSeconds = session.duration_seconds;
  const totalHours = totalSeconds / 3600;

  // Skip sessions < 30 min (not real sleep)
  if (totalHours < 0.5) return null;

  const endTime = new Date(session.session_end_time);
  if (isNaN(endTime.getTime())) return null;

  const startTime = new Date(endTime.getTime() - totalSeconds * 1000);
  const wakeDate = toYMD(endTime);
  const bedtime = formatHHMM(startTime);
  const wakeTime = formatHHMM(endTime);

  // Calculate quality from stages
  let quality = 50; // default when no stage data
  let awakenings = 0;

  if (Array.isArray(session.stages) && session.stages.length > 0) {
    let deepSec = 0;
    let remSec = 0;
    let awakeSec = 0;
    let wasAwake = false;

    for (const stage of session.stages) {
      const type = normalizeStage(stage.stage);
      const dur = stage.duration_seconds ?? 0;

      if (type === "deep") deepSec += dur;
      else if (type === "rem") remSec += dur;
      else if (type === "awake") {
        awakeSec += dur;
        if (!wasAwake) awakenings++;
        wasAwake = true;
        continue;
      }
      wasAwake = false;
    }

    // Quality: deep+REM ratio (target 40-50% of sleep), awakenings penalty
    const sleepSeconds = totalSeconds - awakeSec;
    if (sleepSeconds > 0) {
      const deepRemRatio = (deepSec + remSec) / sleepSeconds;
      // Scale: 0.4+ ratio = 90+, 0.2 = 60, 0.0 = 30
      quality = Math.round(30 + deepRemRatio * 150);
      // Penalty for awakenings (3 points per awakening)
      quality -= awakenings * 3;
      // Bonus/penalty for duration (7-9h ideal)
      if (totalHours >= 7 && totalHours <= 9) quality += 5;
      else if (totalHours < 5 || totalHours > 11) quality -= 10;

      quality = Math.max(0, Math.min(100, quality));
    }
  }

  // Enrich with HRV and HR from the same payload
  let hrv: number | undefined;
  let heartRate: number | undefined;

  // Find HRV readings during sleep window
  if (Array.isArray(payload.heart_rate_variability)) {
    const sleepHrvs = payload.heart_rate_variability.filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= startTime.getTime() && t <= endTime.getTime() &&
        typeof h.rmssd_millis === "number" && h.rmssd_millis >= 1 && h.rmssd_millis <= 300;
    });
    if (sleepHrvs.length > 0) {
      hrv = Math.round(sleepHrvs.reduce((s, h) => s + h.rmssd_millis, 0) / sleepHrvs.length);
    }
  }

  // Find resting HR readings during sleep window (or from resting_heart_rate)
  const hrSource = payload.resting_heart_rate?.length
    ? payload.resting_heart_rate
    : payload.heart_rate;

  if (Array.isArray(hrSource)) {
    const sleepHrs = hrSource.filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= startTime.getTime() && t <= endTime.getTime() &&
        typeof h.bpm === "number" && h.bpm >= 30 && h.bpm <= 200;
    });
    if (sleepHrs.length > 0) {
      // Use minimum HR during sleep as resting approximation
      heartRate = Math.min(...sleepHrs.map((h) => h.bpm));
    }
  }

  return {
    date: wakeDate,
    bedtime,
    wakeTime,
    totalHours: Math.round(totalHours * 100) / 100,
    quality,
    awakenings,
    ...(hrv !== undefined && { hrv }),
    ...(heartRate !== undefined && { heartRate }),
  };
}
