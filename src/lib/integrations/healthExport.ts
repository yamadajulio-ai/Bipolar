import { randomBytes } from "crypto";

/** Generate a 64-char hex API key. */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

// ── Health Auto Export JSON types ────────────────────────────────

interface HAEMetricEntry {
  date?: string;
  startDate?: string;
  endDate?: string;
  value?: string;
  qty?: number;
}

interface HAEMetric {
  name: string;
  units?: string;
  data: HAEMetricEntry[];
}

interface HAEPayload {
  data: {
    metrics: HAEMetric[];
    workouts?: unknown[];
  };
}

export interface ProcessedSleepNight {
  date: string;       // YYYY-MM-DD (morning/wake date)
  bedtime: string;    // HH:MM
  wakeTime: string;   // HH:MM
  totalHours: number;
  quality: number;    // 1-5
  awakenings: number;
}

// ── Parse Health Auto Export date string ─────────────────────────

/**
 * Parse date strings like "2025-06-15 07:00:00 -0300"
 * into a JS Date object.
 */
function parseHAEDate(dateStr: string): Date {
  // Format: "YYYY-MM-DD HH:MM:SS ±HHMM"
  // Replace first space with T for ISO-ish format, remove space before offset
  const cleaned = dateStr.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/, "$1T$2$3");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) {
    // Fallback: try direct parse
    return new Date(dateStr);
  }
  return d;
}

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Sleep stage categorization ──────────────────────────────────

const SLEEP_STAGES = new Set(["Asleep", "Core", "REM", "Deep"]);
const DEEP_REM_STAGES = new Set(["Deep", "REM"]);

interface SleepSegment {
  start: Date;
  end: Date;
  value: string;
}

// ── Main parser ─────────────────────────────────────────────────

/**
 * Parse Health Auto Export JSON payload and extract sleep data.
 * Returns processed sleep nights ready for SleepLog upsert.
 */
export function parseHealthExportPayload(body: unknown): ProcessedSleepNight[] {
  if (!body || typeof body !== "object") return [];

  const payload = body as HAEPayload;
  if (!payload.data?.metrics || !Array.isArray(payload.data.metrics)) return [];

  // Find sleep_analysis metric
  const sleepMetric = payload.data.metrics.find(
    (m) => m.name === "sleep_analysis" || m.name === "Sleep Analysis",
  );
  if (!sleepMetric || !Array.isArray(sleepMetric.data)) return [];

  // Parse all segments
  const segments: SleepSegment[] = [];
  for (const entry of sleepMetric.data) {
    if (!entry.startDate || !entry.endDate) continue;
    const start = parseHAEDate(entry.startDate);
    const end = parseHAEDate(entry.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    segments.push({
      start,
      end,
      value: entry.value || "Asleep",
    });
  }

  if (segments.length === 0) return [];

  // Group segments into nights by clustering:
  // Sort by start time, group segments that are within 12h of each other
  segments.sort((a, b) => a.start.getTime() - b.start.getTime());

  const nights: SleepSegment[][] = [];
  let currentNight: SleepSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start.getTime() - currentNight[currentNight.length - 1].end.getTime();
    if (gap < 12 * 60 * 60 * 1000) {
      // Within 12 hours — same night
      currentNight.push(segments[i]);
    } else {
      nights.push(currentNight);
      currentNight = [segments[i]];
    }
  }
  nights.push(currentNight);

  // Process each night
  return nights.map((nightSegments) => processNight(nightSegments)).filter(Boolean) as ProcessedSleepNight[];
}

function processNight(segments: SleepSegment[]): ProcessedSleepNight | null {
  // Filter to actual sleep stages (exclude "In Bed", "Awake", "Unspecified")
  const sleepSegments = segments.filter((s) => SLEEP_STAGES.has(s.value));
  if (sleepSegments.length === 0) return null;

  // Bedtime = earliest start of any sleep segment
  const bedtime = new Date(Math.min(...sleepSegments.map((s) => s.start.getTime())));
  // Wake time = latest end of any sleep segment
  const wakeTime = new Date(Math.max(...sleepSegments.map((s) => s.end.getTime())));

  // Total sleep hours (sum of sleep segment durations)
  const totalMs = sleepSegments.reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
  const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 10) / 10;

  // Deep + REM hours
  const deepRemMs = segments
    .filter((s) => DEEP_REM_STAGES.has(s.value))
    .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);

  // Quality estimation from deep+REM ratio
  const quality = estimateQuality(deepRemMs, totalMs, segments);

  // Awakenings = number of "Awake" segments
  const awakenings = segments.filter((s) => s.value === "Awake").length;

  // Date = wake date (morning)
  const date = toYMD(wakeTime);

  return {
    date,
    bedtime: formatHHMM(bedtime),
    wakeTime: formatHHMM(wakeTime),
    totalHours,
    quality,
    awakenings,
  };
}

function estimateQuality(deepRemMs: number, totalMs: number, segments: SleepSegment[]): number {
  // If no stage breakdown (only "Asleep"), default to 3
  const hasStageBreakdown = segments.some((s) => s.value === "Core" || s.value === "Deep" || s.value === "REM");
  if (!hasStageBreakdown) return 3;

  if (totalMs === 0) return 1;
  const ratio = deepRemMs / totalMs;
  if (ratio >= 0.35) return 5;
  if (ratio >= 0.25) return 4;
  if (ratio >= 0.15) return 3;
  if (ratio >= 0.08) return 2;
  return 1;
}
