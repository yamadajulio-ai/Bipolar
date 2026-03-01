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
  avg?: number;
  min?: number;
  max?: number;
  sum?: number;
  count?: number;
  source?: string;
  inBed?: string;
  asleep?: string;
}

interface HAEMetric {
  name: string;
  units?: string;
  data: HAEMetricEntry[];
}

interface HAEPayload {
  data?: {
    metrics: HAEMetric[];
    workouts?: unknown[];
  };
  metrics?: HAEMetric[];
}

export interface ProcessedSleepNight {
  date: string;       // YYYY-MM-DD (morning/wake date)
  bedtime: string;    // HH:MM
  wakeTime: string;   // HH:MM
  totalHours: number;
  quality: number;    // 0-100
  awakenings: number;
}

// ── Parse Health Auto Export date string ─────────────────────────

function parseHAEDate(dateStr: string): Date {
  const cleaned = dateStr.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})$/, "$1T$2$3");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) {
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

// ── Sleep stage normalization ───────────────────────────────────
// Apple Health and Health Auto Export use various names for sleep stages
// across different iOS versions and HAE versions. Normalize them all.

type NormalizedStage = "core" | "deep" | "rem" | "asleep" | "inbed" | "awake" | "unknown";

function normalizeStage(value: string): NormalizedStage {
  const v = value.toLowerCase().replace(/[\s_-]/g, "");

  // Deep sleep
  if (v.includes("deep")) return "deep";
  // REM sleep
  if (v.includes("rem")) return "rem";
  // Core / Light sleep
  if (v.includes("core") || v.includes("light")) return "core";
  // In bed (not sleeping)
  if (v.includes("inbed") || v.includes("bed")) return "inbed";
  // Awake
  if (v.includes("awake") || v.includes("wake")) return "awake";
  // Generic asleep (no stage breakdown)
  if (v.includes("asleep") || v.includes("sleep")) return "asleep";

  return "unknown";
}

const ACTUAL_SLEEP_STAGES: Set<NormalizedStage> = new Set(["core", "deep", "rem", "asleep"]);
const DEEP_REM_STAGES: Set<NormalizedStage> = new Set(["deep", "rem"]);

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
  stage: NormalizedStage;
  rawValue: string;
}

// ── Main parser ─────────────────────────────────────────────────

export function parseHealthExportPayload(body: unknown): ProcessedSleepNight[] {
  if (!body || typeof body !== "object") return [];

  const payload = body as HAEPayload;
  const metrics = payload.data?.metrics ?? payload.metrics;
  if (!metrics || !Array.isArray(metrics)) return [];

  const sleepMetric = metrics.find((m) => SLEEP_METRIC_NAMES.has(m.name));
  if (!sleepMetric || !Array.isArray(sleepMetric.data)) return [];

  const detailedResult = parseDetailedSegments(sleepMetric.data);
  if (detailedResult.length > 0) return detailedResult;

  return parseSummarizedData(sleepMetric.data);
}

function parseDetailedSegments(data: HAEMetricEntry[]): ProcessedSleepNight[] {
  const segments: SleepSegment[] = [];
  for (const entry of data) {
    if (!entry.startDate || !entry.endDate) continue;
    const start = parseHAEDate(entry.startDate);
    const end = parseHAEDate(entry.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const rawValue = entry.value || "Asleep";
    const stage = normalizeStage(rawValue);

    segments.push({ start, end, stage, rawValue });
  }

  if (segments.length === 0) return [];

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

function parseSummarizedData(data: HAEMetricEntry[]): ProcessedSleepNight[] {
  const results: ProcessedSleepNight[] = [];

  for (const entry of data) {
    const dateStr = entry.date || entry.startDate || entry.endDate;
    if (!dateStr) continue;

    const d = parseHAEDate(dateStr);
    if (isNaN(d.getTime())) continue;

    let totalHours = 0;
    if (typeof entry.qty === "number" && entry.qty > 0) {
      totalHours = Math.round(entry.qty * 10) / 10;
    } else if (entry.value && !isNaN(Number(entry.value))) {
      totalHours = Math.round(Number(entry.value) * 10) / 10;
    } else if (typeof entry.avg === "number" && entry.avg > 0) {
      totalHours = Math.round(entry.avg * 10) / 10;
    }

    if (totalHours <= 0 || totalHours > 24) continue;

    const wakeTime = d;
    const bedtime = new Date(d.getTime() - totalHours * 60 * 60 * 1000);

    results.push({
      date: toYMD(wakeTime),
      bedtime: formatHHMM(bedtime),
      wakeTime: formatHHMM(wakeTime),
      totalHours,
      quality: 50, // Default — no stage breakdown in summarized mode
      awakenings: 0,
    });
  }

  return results;
}

function processNight(segments: SleepSegment[]): ProcessedSleepNight | null {
  // Filter to actual sleep stages (exclude "inbed", "awake", "unknown")
  const sleepSegments = segments.filter((s) => ACTUAL_SLEEP_STAGES.has(s.stage));
  if (sleepSegments.length === 0) return null;

  const bedtime = new Date(Math.min(...sleepSegments.map((s) => s.start.getTime())));
  const wakeTime = new Date(Math.max(...sleepSegments.map((s) => s.end.getTime())));

  // Total sleep hours (sum of actual sleep stage durations)
  const totalMs = sleepSegments.reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
  const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

  // Deep + REM time
  const deepRemMs = segments
    .filter((s) => DEEP_REM_STAGES.has(s.stage))
    .reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);

  // Quality on 0-100 scale
  const quality = estimateQuality(deepRemMs, totalMs, segments);

  // Awakenings = number of "awake" segments
  const awakenings = segments.filter((s) => s.stage === "awake").length;

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
  // If no stage breakdown (only generic "asleep"), default to 50
  const hasStageBreakdown = segments.some(
    (s) => s.stage === "core" || s.stage === "deep" || s.stage === "rem",
  );
  if (!hasStageBreakdown) return 50;

  if (totalMs === 0) return 0;

  const deepRemRatio = deepRemMs / totalMs;
  // Awakenings penalty
  const awakeCount = segments.filter((s) => s.stage === "awake").length;
  const awakenPenalty = Math.min(awakeCount * 5, 25);

  // Base score from deep+REM ratio (0-100 continuous scale)
  // Ideal: 30-40% deep+REM → score 85-100
  // Good: 20-30% → 65-85
  // Ok: 10-20% → 40-65
  // Poor: <10% → 0-40
  let score = Math.round(Math.min(100, deepRemRatio * 280));

  // Total sleep bonus/penalty
  const totalHours = totalMs / (1000 * 60 * 60);
  if (totalHours >= 7) score = Math.min(100, score + 5);
  else if (totalHours < 5) score = Math.max(0, score - 10);

  score = Math.max(0, score - awakenPenalty);

  return score;
}
