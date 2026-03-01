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
  // Summarized data fields (when "Resumir Dados" is enabled)
  avg?: number;
  min?: number;
  max?: number;
  sum?: number;
  count?: number;
  source?: string;
  // Additional v2 fields
  inBed?: string;
  asleep?: string;
}

interface HAEMetric {
  name: string;
  units?: string;
  data: HAEMetricEntry[];
}

// Support both top-level and nested data formats
interface HAEPayload {
  data?: {
    metrics: HAEMetric[];
    workouts?: unknown[];
  };
  // Some versions put metrics at top level
  metrics?: HAEMetric[];
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
 * Parse date strings in various formats:
 * - "2025-06-15 07:00:00 -0300"
 * - "2025-06-15T07:00:00-0300"
 * - "2025-06-15T07:00:00.000Z"
 * - ISO 8601 formats
 */
function parseHAEDate(dateStr: string): Date {
  // Format: "YYYY-MM-DD HH:MM:SS ±HHMM"
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

// Accept various sleep metric names from different HAE versions
const SLEEP_METRIC_NAMES = new Set([
  "sleep_analysis",
  "Sleep Analysis",
  "sleepAnalysis",
  "sleep",
]);

interface SleepSegment {
  start: Date;
  end: Date;
  value: string;
}

// ── Main parser ─────────────────────────────────────────────────

/**
 * Parse Health Auto Export JSON payload and extract sleep data.
 * Supports:
 * - Detailed mode (individual sleep stage segments with startDate/endDate/value)
 * - Summarized mode ("Resumir Dados" enabled — single entry per night with date + qty)
 * - Both v1 and v2 payload formats
 */
export function parseHealthExportPayload(body: unknown): ProcessedSleepNight[] {
  if (!body || typeof body !== "object") return [];

  const payload = body as HAEPayload;

  // Support both nested (data.metrics) and flat (metrics) formats
  const metrics = payload.data?.metrics ?? payload.metrics;
  if (!metrics || !Array.isArray(metrics)) return [];

  // Find sleep_analysis metric (accept multiple name variants)
  const sleepMetric = metrics.find(
    (m) => SLEEP_METRIC_NAMES.has(m.name),
  );
  if (!sleepMetric || !Array.isArray(sleepMetric.data)) return [];

  // Try detailed parsing first (individual segments with startDate/endDate)
  const detailedResult = parseDetailedSegments(sleepMetric.data);
  if (detailedResult.length > 0) return detailedResult;

  // Fallback: try summarized data parsing (date + qty for total hours)
  return parseSummarizedData(sleepMetric.data);
}

/**
 * Parse detailed sleep segments (when "Resumir Dados" is OFF).
 * Each entry has startDate, endDate, and value (sleep stage).
 */
function parseDetailedSegments(data: HAEMetricEntry[]): ProcessedSleepNight[] {
  const segments: SleepSegment[] = [];
  for (const entry of data) {
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
      currentNight.push(segments[i]);
    } else {
      nights.push(currentNight);
      currentNight = [segments[i]];
    }
  }
  nights.push(currentNight);

  return nights.map((nightSegments) => processNight(nightSegments)).filter(Boolean) as ProcessedSleepNight[];
}

/**
 * Parse summarized sleep data (when "Resumir Dados" is ON).
 * Each entry has a date and qty/value representing total sleep hours.
 * No individual stage breakdown available.
 */
function parseSummarizedData(data: HAEMetricEntry[]): ProcessedSleepNight[] {
  const results: ProcessedSleepNight[] = [];

  for (const entry of data) {
    // Summarized entries typically have date + qty or date + value
    const dateStr = entry.date || entry.startDate || entry.endDate;
    if (!dateStr) continue;

    const d = parseHAEDate(dateStr);
    if (isNaN(d.getTime())) continue;

    // Total hours from qty (number) or value (string like "7.5")
    let totalHours = 0;
    if (typeof entry.qty === "number" && entry.qty > 0) {
      totalHours = Math.round(entry.qty * 10) / 10;
    } else if (entry.value && !isNaN(Number(entry.value))) {
      totalHours = Math.round(Number(entry.value) * 10) / 10;
    } else if (typeof entry.avg === "number" && entry.avg > 0) {
      totalHours = Math.round(entry.avg * 10) / 10;
    }

    // Skip entries with no meaningful sleep data
    if (totalHours <= 0 || totalHours > 24) continue;

    // For summarized data, estimate bedtime/wake time from date and total hours
    const wakeTime = d;
    const bedtime = new Date(d.getTime() - totalHours * 60 * 60 * 1000);

    results.push({
      date: toYMD(wakeTime),
      bedtime: formatHHMM(bedtime),
      wakeTime: formatHHMM(wakeTime),
      totalHours,
      quality: 3, // Default quality — no stage breakdown in summarized mode
      awakenings: 0,
    });
  }

  return results;
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
