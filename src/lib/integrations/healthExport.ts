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
  hrv?: number;       // Heart Rate Variability SDNN (ms)
  heartRate?: number; // Resting heart rate (bpm)
}

export interface ProcessedGenericMetric {
  date: string;       // YYYY-MM-DD
  metric: string;     // "steps", "active_calories", "blood_oxygen"
  value: number;
  unit: string;       // "count", "kcal", "%"
}

export interface HealthExportResult {
  sleepNights: ProcessedSleepNight[];
  hrvHrData: { hrvByDate: Map<string, number>; hrByDate: Map<string, number> };
  genericMetrics: ProcessedGenericMetric[];
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

  // Deep sleep (EN: deep, PT: profundo)
  if (v.includes("deep") || v.includes("profundo")) return "deep";
  // REM sleep (same in all languages)
  if (v.includes("rem")) return "rem";
  // Core / Light sleep (EN: core/light, PT: núcleo/essencial)
  if (v.includes("core") || v.includes("light") || v.includes("nucleo") || v.includes("núcleo") || v.includes("essencial")) return "core";
  // In bed (EN: inbed/bed, PT: na cama/cama)
  if (v.includes("inbed") || v.includes("bed") || v.includes("cama")) return "inbed";
  // Awake (EN: awake/wake, PT: acordado/desperto)
  if (v.includes("awake") || v.includes("wake") || v.includes("acordado") || v.includes("desperto")) return "awake";
  // Generic asleep (EN: asleep/sleep, PT: dormindo/adormecido)
  if (v.includes("asleep") || v.includes("sleep") || v.includes("dormindo") || v.includes("adormecido")) return "asleep";

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
  source: string;
}

// ── HRV and Heart Rate metric names ─────────────────────────────

const HRV_METRIC_NAMES = new Set([
  "heart_rate_variability",
  "Heart Rate Variability",
  "heartRateVariability",
  "heart_rate_variability_sdnn",
]);

const HR_METRIC_NAMES = new Set([
  "resting_heart_rate",
  "Resting Heart Rate",
  "restingHeartRate",
  "heart_rate",
  "Heart Rate",
  "heartRate",
]);

/** Build a map of date → average value from a HAE metric. */
function buildDailyAvgMap(metric: HAEMetric | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!metric?.data) return map;

  const dayValues = new Map<string, number[]>();

  for (const entry of metric.data) {
    const dateStr = entry.date || entry.startDate || entry.endDate;
    if (!dateStr) continue;

    let val: number | undefined;
    if (typeof entry.avg === "number" && entry.avg > 0) val = entry.avg;
    else if (typeof entry.qty === "number" && entry.qty > 0) val = entry.qty;
    else if (entry.value && !isNaN(Number(entry.value)) && Number(entry.value) > 0) val = Number(entry.value);

    if (val === undefined) continue;

    const d = parseHAEDate(dateStr);
    if (isNaN(d.getTime())) continue;
    const ymd = toYMD(d);

    const arr = dayValues.get(ymd) ?? [];
    arr.push(val);
    dayValues.set(ymd, arr);
  }

  for (const [ymd, values] of dayValues) {
    map.set(ymd, Math.round(values.reduce((a, b) => a + b, 0) / values.length));
  }

  return map;
}

// ── Metric detection helpers ────────────────────────────────────
// Health Auto Export may omit the `name` field when exporting all
// data types. Detect metrics by inspecting entry content as fallback.

const SLEEP_STAGE_KEYWORDS = new Set([
  "core", "deep", "rem", "asleep", "awake", "inbed",
  "núcleo", "profundo", "acordado", "adormecido", "na cama", "essencial",
]);

function looksLikeSleepMetric(m: HAEMetric): boolean {
  if (SLEEP_METRIC_NAMES.has(m.name)) return true;
  if (!Array.isArray(m.data) || m.data.length === 0) return false;
  // Check first few entries for sleep stage values
  const sample = m.data.slice(0, 10);
  return sample.some((e) => {
    if (!e.value) return false;
    const v = e.value.toLowerCase().replace(/[\s_-]/g, "");
    return SLEEP_STAGE_KEYWORDS.has(e.value.toLowerCase()) ||
      [...SLEEP_STAGE_KEYWORDS].some((kw) => v.includes(kw.replace(/[\s_-]/g, "")));
  });
}

const HRV_UNITS = new Set(["ms", "milliseconds"]);
const HR_UNITS = new Set(["bpm", "count/min"]);

function looksLikeHRVMetric(m: HAEMetric): boolean {
  if (HRV_METRIC_NAMES.has(m.name)) return true;
  // HRV metrics have units "ms" and numeric values typically 10-200
  if (!m.units || !HRV_UNITS.has(m.units)) return false;
  const sample = m.data?.slice(0, 5) ?? [];
  return sample.some((e) => {
    const v = e.qty ?? e.avg ?? (e.value ? Number(e.value) : NaN);
    return typeof v === "number" && v >= 5 && v <= 300;
  });
}

function looksLikeHRMetric(m: HAEMetric): boolean {
  if (HR_METRIC_NAMES.has(m.name)) return true;
  // HR metrics have units "bpm" or "count/min" and values typically 40-120
  if (!m.units || !HR_UNITS.has(m.units)) return false;
  const sample = m.data?.slice(0, 5) ?? [];
  return sample.some((e) => {
    const v = e.qty ?? e.avg ?? (e.value ? Number(e.value) : NaN);
    return typeof v === "number" && v >= 30 && v <= 200;
  });
}

// ── Generic metric detection (table-driven) ─────────────────────

interface GenericMetricDef {
  names: Set<string>;
  units: Set<string>;
  metricKey: string;
  canonicalUnit: string;
  minValue: number;
  maxValue: number;
  aggregation: "sum" | "avg";
}

const GENERIC_METRIC_DEFS: GenericMetricDef[] = [
  {
    names: new Set(["step_count", "Step Count", "stepCount", "steps"]),
    units: new Set(["count", "steps"]),
    metricKey: "steps",
    canonicalUnit: "count",
    minValue: 0,
    maxValue: 200000,
    aggregation: "sum",
  },
  {
    names: new Set(["active_energy", "Active Energy", "activeEnergy", "active_calories"]),
    units: new Set(["kcal", "Cal", "kCal"]),
    metricKey: "active_calories",
    canonicalUnit: "kcal",
    minValue: 0,
    maxValue: 10000,
    aggregation: "sum",
  },
  {
    names: new Set(["blood_oxygen", "Blood Oxygen", "bloodOxygen", "oxygen_saturation"]),
    units: new Set(["%"]),
    metricKey: "blood_oxygen",
    canonicalUnit: "%",
    minValue: 50,
    maxValue: 100,
    aggregation: "avg",
  },
];

function matchGenericMetric(m: HAEMetric): GenericMetricDef | null {
  for (const def of GENERIC_METRIC_DEFS) {
    if (def.names.has(m.name)) return def;
  }
  if (!m.units) return null;
  for (const def of GENERIC_METRIC_DEFS) {
    if (!def.units.has(m.units)) continue;
    const sample = m.data?.slice(0, 5) ?? [];
    const hasValidValue = sample.some((e) => {
      const v = e.qty ?? e.sum ?? e.avg ?? (e.value ? Number(e.value) : NaN);
      return typeof v === "number" && v >= def.minValue && v <= def.maxValue;
    });
    if (hasValidValue) return def;
  }
  return null;
}

function extractGenericMetrics(metric: HAEMetric, def: GenericMetricDef): ProcessedGenericMetric[] {
  const dayValues = new Map<string, number[]>();

  for (const entry of metric.data) {
    const dateStr = entry.date || entry.startDate || entry.endDate;
    if (!dateStr) continue;

    let val: number | undefined;
    if (def.aggregation === "avg") {
      if (typeof entry.avg === "number" && entry.avg > 0) val = entry.avg;
      else if (typeof entry.qty === "number" && entry.qty > 0) val = entry.qty;
      else if (entry.value && !isNaN(Number(entry.value))) val = Number(entry.value);
    } else {
      if (typeof entry.sum === "number" && entry.sum > 0) val = entry.sum;
      else if (typeof entry.qty === "number" && entry.qty > 0) val = entry.qty;
      else if (entry.value && !isNaN(Number(entry.value))) val = Number(entry.value);
    }

    if (val === undefined || val < def.minValue || val > def.maxValue) continue;

    const d = parseHAEDate(dateStr);
    if (isNaN(d.getTime())) continue;
    const ymd = toYMD(d);

    const arr = dayValues.get(ymd) ?? [];
    arr.push(val);
    dayValues.set(ymd, arr);
  }

  const results: ProcessedGenericMetric[] = [];
  for (const [ymd, values] of dayValues) {
    const aggregated = def.aggregation === "avg"
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : Math.round(values.reduce((a, b) => a + b, 0));
    results.push({ date: ymd, metric: def.metricKey, value: aggregated, unit: def.canonicalUnit });
  }

  return results;
}

// ── Main parser ─────────────────────────────────────────────────

export function parseHealthExportPayloadV2(body: unknown): HealthExportResult {
  const empty: HealthExportResult = {
    sleepNights: [],
    hrvHrData: { hrvByDate: new Map(), hrByDate: new Map() },
    genericMetrics: [],
  };

  if (!body || typeof body !== "object") return empty;

  const payload = body as HAEPayload;
  const metrics = payload.data?.metrics ?? payload.metrics;
  if (!metrics || !Array.isArray(metrics)) return empty;

  // 1. Sleep (existing logic)
  const sleepMetric = metrics.find((m) => looksLikeSleepMetric(m));
  let sleepNights: ProcessedSleepNight[] = [];
  if (sleepMetric && Array.isArray(sleepMetric.data)) {
    const detailedResult = parseDetailedSegments(sleepMetric.data);
    sleepNights = detailedResult.length > 0 ? detailedResult : parseSummarizedData(sleepMetric.data);
  }

  // 2. HRV and HR (always extracted, even without sleep)
  const hrvMetric = metrics.find((m) => looksLikeHRVMetric(m));
  const hrMetric = metrics.find((m) => looksLikeHRMetric(m));
  const hrvByDate = buildDailyAvgMap(hrvMetric);
  const hrByDate = buildDailyAvgMap(hrMetric);

  // Enrich sleep nights if both present in same payload
  for (const night of sleepNights) {
    const hrv = hrvByDate.get(night.date);
    const hr = hrByDate.get(night.date);
    if (hrv !== undefined && hrv >= 1 && hrv <= 300) night.hrv = hrv;
    if (hr !== undefined && hr >= 20 && hr <= 250) night.heartRate = hr;
  }

  // 3. Generic metrics (steps, calories, blood oxygen)
  const genericMetrics: ProcessedGenericMetric[] = [];
  for (const m of metrics) {
    // Skip metrics already handled above
    if (looksLikeSleepMetric(m) || looksLikeHRVMetric(m) || looksLikeHRMetric(m)) continue;
    const def = matchGenericMetric(m);
    if (def) {
      genericMetrics.push(...extractGenericMetrics(m, def));
    }
  }

  return { sleepNights, hrvHrData: { hrvByDate, hrByDate }, genericMetrics };
}

/** Backward-compatible wrapper — returns only sleep nights. */
export function parseHealthExportPayload(body: unknown): ProcessedSleepNight[] {
  return parseHealthExportPayloadV2(body).sleepNights;
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

    segments.push({ start, end, stage, rawValue, source: entry.source || "unknown" });
  }

  if (segments.length === 0) return [];

  segments.sort((a, b) => a.start.getTime() - b.start.getTime());

  const nights: SleepSegment[][] = [];
  let currentNight: SleepSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start.getTime() - currentNight[currentNight.length - 1].end.getTime();
    // 6h gap — prevents grouping naps with night sleep (was 12h)
    if (gap < 6 * 60 * 60 * 1000) {
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
  // When multiple sources exist (e.g. Apple Watch + AutoSleep), pick only the
  // best one to avoid double-counting the same sleep period.
  const sources = new Set(segments.map((s) => s.source));
  if (sources.size > 1) {
    // Pick the source with the most detailed stage segments (core/deep/rem)
    let bestSource = "";
    let bestCount = -1;
    for (const src of sources) {
      const detailed = segments.filter(
        (s) => s.source === src && (s.stage === "core" || s.stage === "deep" || s.stage === "rem"),
      ).length;
      if (detailed > bestCount) {
        bestCount = detailed;
        bestSource = src;
      }
    }
    segments = segments.filter((s) => s.source === bestSource);
  }

  // All actual sleep stages (exclude "inbed", "awake", "unknown")
  const allSleepSegments = segments.filter((s) => ACTUAL_SLEEP_STAGES.has(s.stage));
  if (allSleepSegments.length === 0) return null;

  // If we have detailed stage breakdown (core/deep/rem), use those for duration
  // calculation to avoid double-counting. But ALWAYS use all sleep segments
  // (including generic "asleep") for bedtime/wakeTime boundaries.
  const hasStageBreakdown = allSleepSegments.some(
    (s) => s.stage === "core" || s.stage === "deep" || s.stage === "rem",
  );
  let sleepSegments = hasStageBreakdown
    ? allSleepSegments.filter((s) => s.stage !== "asleep")
    : allSleepSegments;

  // Bedtime/wakeTime: use ALL sleep segments (including generic "asleep") for
  // accurate boundaries. Apple Health sends "asleep" spanning the full night
  // plus detailed stages as subsets — we need the full span for bedtime/wake.
  const bedtime = new Date(Math.min(...allSleepSegments.map((s) => s.start.getTime())));
  const wakeTime = new Date(Math.max(...allSleepSegments.map((s) => s.end.getTime())));

  // Total sleep hours: when we have both generic "asleep" and detailed stages,
  // use the full sleep span minus awake segments for more accurate total.
  // This avoids the bug where summing only detailed stages gives a fraction
  // of actual sleep time (e.g. 4h instead of 8h).
  let totalMs: number;
  if (hasStageBreakdown && allSleepSegments.some((s) => s.stage === "asleep")) {
    // We have both generic and detailed: use span minus awake time
    const spanMs = wakeTime.getTime() - bedtime.getTime();
    const awakeMs = segments
      .filter((s) => s.stage === "awake")
      .reduce((sum, s) => {
        const segStart = Math.max(s.start.getTime(), bedtime.getTime());
        const segEnd = Math.min(s.end.getTime(), wakeTime.getTime());
        return sum + Math.max(0, segEnd - segStart);
      }, 0);
    totalMs = spanMs - awakeMs;
  } else {
    // Only one type of data: sum the sleep segments directly
    totalMs = sleepSegments.reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()), 0);
  }
  const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

  // Deep + REM time (from selected source only)
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
