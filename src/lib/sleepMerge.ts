/**
 * Sleep data merge system — v2.
 *
 * Architecture: reconciliation model, not overwrite.
 * Each field has a declared owner. When two sources overlap for the same
 * sleep session, reconcileSleepRecord() produces a canonical record with
 * per-field provenance tracking.
 *
 * Field ownership contract (strict, no exceptions):
 *   WEARABLE-WINS (sensor-only, always overwritten by wearable):
 *     bedtime, wakeTime, totalHours, bedtimeAt, wakeTimeAt  (timing)
 *     awakeMinutes, hrv, heartRate                           (biometrics)
 *     awakenings                                             (stage-derived)
 *
 *   MANUAL-WINS (human-only, never overwritten by wearable):
 *     perceivedQuality                                       (subjective rating)
 *     preRoutine, notes                                      (free text)
 *
 *   DERIVED:
 *     quality — wearable-derived when hasStages, else perceivedQuality
 *     excluded — user decision, preserved across merges
 *
 *   METADATA (set by system):
 *     source, fieldProvenance, providerRecordId, rawHash, mergeLog
 */

import { createHash } from "crypto";

// ── Algorithm versioning ──────────────────────────────────────────
export const MERGE_ALGORITHM_VERSION = "2.1.1";

// ── Time utilities ────────────────────────────────────────────────

/** Convert "HH:MM" to minutes since midnight */
export function bedtimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Clock-distance in minutes between two HH:MM strings (handles midnight crossing) */
export function clockDistance(a: string, b: string): number {
  const aMin = bedtimeToMinutes(a);
  const bMin = bedtimeToMinutes(b);
  const diff = Math.abs(aMin - bMin);
  return diff > 720 ? 1440 - diff : diff;
}

/**
 * Compute absolute UTC timestamps from date (morning/wake date) + HH:MM times.
 * Timezone: America/Sao_Paulo (project contract).
 *
 * Logic:
 *   - bedtime minutes > wakeTime minutes → overnight (bedtime on date - 1 day)
 *   - bedtime minutes <= wakeTime minutes → same day (nap, early morning)
 *   - wakeTime is always on the morning date
 *
 * This handles both overnight sleep (23:00→07:00) and daytime naps (14:00→15:00).
 */
export function computeAbsoluteTimestamps(
  date: string,
  bedtime: string,
  wakeTime: string,
): { bedtimeAt: Date; wakeTimeAt: Date } {
  const [bH, bM] = bedtime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);

  // Parse the morning date
  const [year, month, day] = date.split("-").map(Number);

  // Determine if overnight by comparing bedtime vs wakeTime in minutes
  const bedMin = bH * 60 + bM;
  const wakeMin = wH * 60 + wM;
  const isOvernight = bedMin > wakeMin;

  // Bedtime: if overnight, it's the previous day; otherwise same day
  const bedDate = new Date(Date.UTC(year, month - 1, day));
  if (isOvernight) {
    bedDate.setUTCDate(bedDate.getUTCDate() - 1);
  }
  // America/Sao_Paulo is UTC-3 (no DST since 2019 — acceptable for matching)
  const bedtimeAt = new Date(Date.UTC(bedDate.getUTCFullYear(), bedDate.getUTCMonth(), bedDate.getUTCDate(), bH + 3, bM));

  const wakeTimeAt = new Date(Date.UTC(year, month - 1, day, wH + 3, wM));

  return { bedtimeAt, wakeTimeAt };
}

// ── Interval overlap matching ─────────────────────────────────────

export interface SleepInterval {
  bedtimeAt: Date;
  wakeTimeAt: Date;
}

/**
 * Compute overlap ratio between two sleep intervals.
 * Returns 0..1 where 1 = perfect overlap, 0 = no overlap.
 * Falls back to clock-distance if absolute timestamps are unavailable.
 */
export function intervalOverlap(a: SleepInterval, b: SleepInterval): number {
  const aStart = a.bedtimeAt.getTime();
  const aEnd = a.wakeTimeAt.getTime();
  const bStart = b.bedtimeAt.getTime();
  const bEnd = b.wakeTimeAt.getTime();

  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlap = Math.max(0, overlapEnd - overlapStart);

  const unionStart = Math.min(aStart, bStart);
  const unionEnd = Math.max(aEnd, bEnd);
  const union = unionEnd - unionStart;

  return union > 0 ? overlap / union : 0;
}

/**
 * Find the best matching existing record for an incoming sleep session.
 *
 * Matching strategy (two-tier):
 *   1. Interval overlap (IoU) when absolute timestamps are available.
 *      Minimum: OVERLAP_MIN_SCORE (0.1 = 10% overlap).
 *   2. Clock-distance fallback when timestamps are missing.
 *      Effective window: ≤26 min (due to floating-point: 1 - 27/30 = 0.0999... < 0.1).
 *      27+ min is rejected because the normalized score drops below OVERLAP_MIN_SCORE.
 *
 * Returns the match and its overlap score, or null if no match.
 */
const OVERLAP_MIN_SCORE = 0.1;

export function findBestMatch<T extends {
  bedtime: string;
  bedtimeAt?: Date | null;
  wakeTimeAt?: Date | null;
}>(
  incoming: { bedtime: string; bedtimeAt?: Date; wakeTimeAt?: Date },
  candidates: T[],
  thresholdMin = 30,
): { match: T; overlapScore: number } | null {
  let bestMatch: T | null = null;
  let bestScore = 0;

  for (const c of candidates) {
    // Try interval overlap first
    if (incoming.bedtimeAt && incoming.wakeTimeAt && c.bedtimeAt && c.wakeTimeAt) {
      const score = intervalOverlap(
        { bedtimeAt: incoming.bedtimeAt, wakeTimeAt: incoming.wakeTimeAt },
        { bedtimeAt: c.bedtimeAt, wakeTimeAt: c.wakeTimeAt },
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = c;
      }
    } else {
      // Fallback: clock-distance normalized to 0..1
      // Effective match window: ≤26 min (27 min → score 0.0999... < OVERLAP_MIN_SCORE due to float)
      const dist = clockDistance(incoming.bedtime, c.bedtime);
      if (dist <= thresholdMin) {
        const score = 1 - (dist / thresholdMin);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = c;
        }
      }
    }
  }

  if (bestMatch && bestScore >= OVERLAP_MIN_SCORE) {
    return { match: bestMatch, overlapScore: bestScore };
  }
  return null;
}

// ── Provider identity ─────────────────────────────────────────────

/** Recursively sort object keys for canonical serialization */
function deepSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepSortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/** Generate a stable hash from raw payload data for dedup (deep-canonicalized) */
export function computeRawHash(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(deepSortKeys(data));
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Build a stable provider record ID from available data */
export function buildProviderRecordId(
  provider: "hae" | "health_connect",
  date: string,
  bedtime: string,
  sourceApp?: string,
): string {
  return `${provider}:${date}:${bedtime}${sourceApp ? `:${sourceApp}` : ""}`;
}

// ── Field provenance ──────────────────────────────────────────────

export type FieldSource = "manual" | "hae" | "health_connect" | "unknown_legacy";

export interface FieldProvenance {
  bedtime: FieldSource;
  wakeTime: FieldSource;
  totalHours: FieldSource;
  quality: FieldSource;
  perceivedQuality?: FieldSource;
  awakenings: FieldSource;
  awakeMinutes: FieldSource;
  hrv?: FieldSource;
  heartRate?: FieldSource;
  preRoutine?: FieldSource;
  notes?: FieldSource;
}

// ── Merge log entry ───────────────────────────────────────────────

export interface MergeLogEntry {
  ts: string; // ISO timestamp
  algorithmVersion: string;
  action: "create" | "merge_manual_into_wearable" | "merge_wearable_into_manual" | "update_wearable" | "update_manual" | "enrich_wearable_biometrics";
  importBatchId?: string;
  incomingSource: FieldSource;
  existingSource?: FieldSource;
  overlapScore?: number;
  fieldsKept: string[]; // fields preserved from existing
  fieldsOverwritten: string[]; // fields overwritten by incoming
  reason: string;
}

function createMergeLogEntry(
  action: MergeLogEntry["action"],
  incomingSource: FieldSource,
  existingSource: FieldSource | undefined,
  overlapScore: number | undefined,
  fieldsKept: string[],
  fieldsOverwritten: string[],
  reason: string,
  importBatchId?: string,
): MergeLogEntry {
  return {
    ts: new Date().toISOString(),
    algorithmVersion: MERGE_ALGORITHM_VERSION,
    action,
    importBatchId,
    incomingSource,
    existingSource,
    overlapScore,
    fieldsKept,
    fieldsOverwritten,
    reason,
  };
}

// ── Core reconciliation ───────────────────────────────────────────

/** Existing record from DB for merge comparison */
export interface ExistingRecord {
  id: string;
  date?: string;
  bedtime: string;
  wakeTime: string;
  bedtimeAt: Date | null;
  wakeTimeAt: Date | null;
  totalHours: number;
  quality: number;
  perceivedQuality: number | null;
  awakenings: number;
  awakeMinutes: number;
  hrv: number | null;
  heartRate: number | null;
  excluded: boolean;
  source: string;
  fieldProvenance: string | null;
  providerRecordId: string | null;
  rawHash: string | null;
  preRoutine: string | null;
  notes: string | null;
  mergeLog: string | null;
}

/** Incoming wearable data */
export interface IncomingWearable {
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
  awakeMinutes: number;
  hrv?: number | null;
  heartRate?: number | null;
  hasStages: boolean;
  providerRecordId?: string;
  rawHash?: string;
}

/** Incoming manual data */
export interface IncomingManual {
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number; // user's perceived quality
  awakenings: number;
  hrv?: number | null;
  heartRate?: number | null;
  preRoutine?: string | null;
  notes?: string | null;
}

/** Result of reconciliation — the canonical record to upsert */
export interface ReconcileResult {
  data: Record<string, unknown>;
  fieldProvenance: FieldProvenance;
  mergeLogEntry: MergeLogEntry;
  mergeLog: MergeLogEntry[]; // full history
  operations: Array<{ type: "delete"; id: string } | { type: "upsert" }>;
}

/**
 * Reconcile a MANUAL entry against an existing (possibly wearable) record.
 *
 * Contract: manual is a subjective overlay — it NEVER overwrites wearable timing
 * or biometrics. When the existing record has a wearable base:
 *   - Timing (bedtime, wakeTime, totalHours, bedtimeAt, wakeTimeAt): WEARABLE kept
 *   - Biometrics (awakeMinutes, hrv, heartRate, awakenings): WEARABLE kept
 *   - Quality: WEARABLE-derived kept, manual stored as perceivedQuality
 *   - Source: stays as wearable (manual is overlay, not ownership transfer)
 *   - Subjective (perceivedQuality, preRoutine, notes): MANUAL wins
 *   - Provider identity (providerRecordId, rawHash): preserved from wearable
 */
export function reconcileManualIntoExisting(
  manual: IncomingManual,
  existing: ExistingRecord | null,
  date: string,
  importBatchId?: string,
  overlapScore?: number,
): ReconcileResult {
  const isWearableBase = existing != null && hasWearableBase(existing);

  // Timing: wearable wins when wearable base exists
  const finalBedtime = isWearableBase ? existing!.bedtime : manual.bedtime;
  const finalWakeTime = isWearableBase ? existing!.wakeTime : manual.wakeTime;
  const { bedtimeAt, wakeTimeAt } = isWearableBase && existing!.bedtimeAt && existing!.wakeTimeAt
    ? { bedtimeAt: existing!.bedtimeAt, wakeTimeAt: existing!.wakeTimeAt }
    : computeAbsoluteTimestamps(date, finalBedtime, finalWakeTime);

  const fieldsKept: string[] = [];
  const fieldsOverwritten: string[] = ["perceivedQuality", "preRoutine", "notes"];

  const data: Record<string, unknown> = {
    bedtime: finalBedtime,
    wakeTime: finalWakeTime,
    bedtimeAt,
    wakeTimeAt,
    perceivedQuality: manual.quality,
    preRoutine: manual.preRoutine ?? null,
    notes: manual.notes ?? null,
  };

  let provenance: FieldProvenance;

  if (isWearableBase) {
    const wSrc = existing!.source as FieldSource;

    // Check if quality ownership is manual (wearable without stages set quality to manual)
    const existingFpW = existing!.fieldProvenance ? safeParseProvenance(existing!.fieldProvenance) : {};
    const qualityIsManualOwned = existingFpW.quality === "manual";

    // Wearable timing + biometrics preserved entirely
    data.totalHours = existing!.totalHours;
    data.awakeMinutes = existing!.awakeMinutes;
    data.awakenings = existing!.awakenings;
    data.hrv = existing!.hrv;
    data.heartRate = existing!.heartRate;
    // Quality: if owned by manual (wearable had no stages), manual can update it
    data.quality = qualityIsManualOwned ? manual.quality : existing!.quality;
    data.excluded = existing!.excluded;
    data.providerRecordId = existing!.providerRecordId;
    data.rawHash = existing!.rawHash;
    // Source stays as wearable — manual is overlay, not ownership transfer
    data.source = existing!.source;
    fieldsKept.push(
      "bedtime", "wakeTime", "totalHours", "awakeMinutes", "awakenings",
      "hrv", "heartRate", "excluded", "providerRecordId", "rawHash", "source",
    );
    if (qualityIsManualOwned) {
      fieldsOverwritten.push("quality");
    } else {
      fieldsKept.push("quality");
    }

    provenance = {
      bedtime: wSrc,
      wakeTime: wSrc,
      totalHours: wSrc,
      quality: qualityIsManualOwned ? "manual" : wSrc,
      perceivedQuality: "manual",
      awakenings: wSrc,
      awakeMinutes: wSrc,
      hrv: existing!.hrv != null ? wSrc : undefined,
      heartRate: existing!.heartRate != null ? wSrc : undefined,
      preRoutine: manual.preRoutine != null ? "manual" : undefined,
      notes: manual.notes != null ? "manual" : undefined,
    };
  } else {
    // Pure manual or legacy — manual owns everything (except wearable-enriched biometrics)
    data.totalHours = manual.totalHours;
    data.awakeMinutes = 0;
    data.awakenings = manual.awakenings;
    data.quality = manual.quality;
    data.source = "manual";

    // Check if existing record has wearable-enriched biometrics (from standalone HRV/HR import)
    const existingFp = existing?.fieldProvenance ? safeParseProvenance(existing.fieldProvenance) : null;
    const hrvWearableEnriched = isWearableSource(existingFp?.hrv);
    const hrWearableEnriched = isWearableSource(existingFp?.heartRate);

    // Preserve wearable-enriched biometrics when manual doesn't provide values
    data.hrv = manual.hrv ?? (hrvWearableEnriched && existing!.hrv != null ? existing!.hrv : null);
    data.heartRate = manual.heartRate ?? (hrWearableEnriched && existing!.heartRate != null ? existing!.heartRate : null);

    fieldsOverwritten.push("bedtime", "wakeTime", "totalHours", "awakeMinutes", "awakenings", "quality");
    if (manual.hrv != null || !hrvWearableEnriched) {
      fieldsOverwritten.push("hrv");
    } else {
      fieldsKept.push("hrv");
    }
    if (manual.heartRate != null || !hrWearableEnriched) {
      fieldsOverwritten.push("heartRate");
    } else {
      fieldsKept.push("heartRate");
    }

    if (existing) {
      data.excluded = existing.excluded;
      fieldsKept.push("excluded");
    }

    provenance = {
      bedtime: "manual",
      wakeTime: "manual",
      totalHours: "manual",
      quality: "manual",
      perceivedQuality: "manual",
      awakenings: "manual",
      awakeMinutes: "manual",
      hrv: manual.hrv != null ? "manual" : (hrvWearableEnriched ? existingFp!.hrv : undefined),
      heartRate: manual.heartRate != null ? "manual" : (hrWearableEnriched ? existingFp!.heartRate : undefined),
      preRoutine: manual.preRoutine != null ? "manual" : undefined,
      notes: manual.notes != null ? "manual" : undefined,
    };
  }

  data.fieldProvenance = JSON.stringify(provenance);

  // Build merge log
  const existingLog = existing?.mergeLog ? safeParseMergeLog(existing.mergeLog) : [];
  const entry = createMergeLogEntry(
    isWearableBase ? "merge_manual_into_wearable" : (existing ? "update_manual" : "create"),
    "manual",
    existing?.source as FieldSource | undefined,
    overlapScore,
    fieldsKept,
    fieldsOverwritten,
    isWearableBase
      ? `Manual subjective overlay on ${existing!.source} record; wearable timing/biometrics preserved`
      : existing ? "Manual update of existing manual record" : "New manual sleep record",
    importBatchId,
  );
  const mergeLog = [...existingLog, entry];
  data.mergeLog = JSON.stringify(mergeLog);

  // Operations: only delete if existing bedtime differs from FINAL bedtime
  // (When wearable base, finalBedtime === existing.bedtime → no delete)
  const operations: ReconcileResult["operations"] = [];
  if (existing && existing.bedtime !== finalBedtime) {
    operations.push({ type: "delete", id: existing.id });
  }
  operations.push({ type: "upsert" });

  return { data, fieldProvenance: provenance, mergeLogEntry: entry, mergeLog, operations };
}

/**
 * Reconcile a WEARABLE entry against an existing (possibly manual) record.
 *
 * Contract: wearable ALWAYS wins on timing/biometrics, manual ALWAYS wins
 * on subjective fields. HRV/HR: wearable wins unconditionally.
 */
export function reconcileWearableIntoExisting(
  wearable: IncomingWearable,
  existing: ExistingRecord | null,
  date: string,
  wearableSource: "hae" | "health_connect",
  importBatchId?: string,
  overlapScore?: number,
): ReconcileResult {
  const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(date, wearable.bedtime, wearable.wakeTime);
  const hasManualSubjective = existing && hasManualFieldProvenance(existing);

  const provenance: FieldProvenance = {
    bedtime: wearableSource,
    wakeTime: wearableSource,
    totalHours: wearableSource,
    quality: wearable.hasStages ? wearableSource : (hasManualSubjective ? "manual" : wearableSource),
    awakenings: wearableSource,
    awakeMinutes: wearableSource,
    hrv: wearable.hrv != null ? wearableSource : undefined,
    heartRate: wearable.heartRate != null ? wearableSource : undefined,
  };

  const data: Record<string, unknown> = {
    bedtime: wearable.bedtime,
    wakeTime: wearable.wakeTime,
    bedtimeAt,
    wakeTimeAt,
    totalHours: wearable.totalHours,
    awakenings: wearable.awakenings,
    awakeMinutes: wearable.awakeMinutes,
    hrv: wearable.hrv ?? null,
    heartRate: wearable.heartRate ?? null,
    source: wearableSource,
    providerRecordId: wearable.providerRecordId ?? existing?.providerRecordId ?? null,
    rawHash: wearable.rawHash ?? existing?.rawHash ?? null,
  };

  const fieldsKept: string[] = [];
  const fieldsOverwritten: string[] = ["bedtime", "wakeTime", "totalHours", "awakenings", "awakeMinutes", "hrv", "heartRate"];

  // Quality: wearable-derived if hasStages, else preserve manual/existing
  if (wearable.hasStages) {
    data.quality = wearable.quality;
    fieldsOverwritten.push("quality");
  } else if (hasManualSubjective) {
    data.quality = existing!.perceivedQuality ?? existing!.quality;
    fieldsKept.push("quality");
  } else {
    data.quality = wearable.quality;
    fieldsOverwritten.push("quality");
  }

  // Preserve manual subjective data
  if (hasManualSubjective) {
    data.perceivedQuality = existing!.perceivedQuality ?? existing!.quality;
    data.preRoutine = existing!.preRoutine;
    data.notes = existing!.notes;
    data.excluded = existing!.excluded;
    provenance.perceivedQuality = "manual";
    provenance.preRoutine = existing!.preRoutine != null ? "manual" : undefined;
    provenance.notes = existing!.notes != null ? "manual" : undefined;
    fieldsKept.push("perceivedQuality", "preRoutine", "notes", "excluded");
  } else {
    data.perceivedQuality = null;
    data.preRoutine = existing?.preRoutine ?? null;
    data.notes = existing?.notes ?? null;
    if (existing) {
      data.excluded = existing.excluded;
      fieldsKept.push("excluded");
    }
  }

  data.fieldProvenance = JSON.stringify(provenance);

  // Build merge log
  const existingLog = existing?.mergeLog ? safeParseMergeLog(existing.mergeLog) : [];
  const entry = createMergeLogEntry(
    hasManualSubjective ? "merge_wearable_into_manual" : (existing ? "update_wearable" : "create"),
    wearableSource,
    existing?.source as FieldSource | undefined,
    overlapScore,
    fieldsKept,
    fieldsOverwritten,
    hasManualSubjective
      ? `Wearable (${wearableSource}) merged into record with manual subjective data; manual quality/preRoutine/notes preserved`
      : existing ? `Wearable (${wearableSource}) update of existing record` : `New wearable (${wearableSource}) sleep record`,
    importBatchId,
  );
  const mergeLog = [...existingLog, entry];
  data.mergeLog = JSON.stringify(mergeLog);

  // Operations
  const operations: ReconcileResult["operations"] = [];
  if (existing && existing.bedtime !== wearable.bedtime) {
    operations.push({ type: "delete", id: existing.id });
  }
  operations.push({ type: "upsert" });

  return { data, fieldProvenance: provenance, mergeLogEntry: entry, mergeLog, operations };
}

// ── Helpers ───────────────────────────────────────────────────────

/** Guard: true if source string indicates a wearable/device origin (not manual or legacy) */
export function isWearableSource(source: string | undefined | null): boolean {
  return source != null && source !== "manual" && source !== "unknown_legacy";
}

/**
 * Check if an existing record has a wearable-owned base (timing/biometrics).
 * Uses fieldProvenance first, then falls back to source.
 * This determines whether manual edits are overlays (wearable base)
 * or full replacements (manual/legacy base).
 */
function hasWearableBase(existing: ExistingRecord): boolean {
  // Check fieldProvenance for wearable-owned timing
  if (existing.fieldProvenance) {
    try {
      const fp = JSON.parse(existing.fieldProvenance) as Partial<FieldProvenance>;
      if (fp.bedtime && isWearableSource(fp.bedtime)) {
        return true;
      }
    } catch { /* fall through */ }
  }
  // Fallback: check source
  return isWearableSource(existing.source);
}

/**
 * Check if an existing record has manual-sourced subjective fields,
 * looking at fieldProvenance first, then source + non-null fields.
 */
function hasManualFieldProvenance(existing: ExistingRecord): boolean {
  // Check fieldProvenance JSONB if available
  if (existing.fieldProvenance) {
    try {
      const fp = JSON.parse(existing.fieldProvenance) as Partial<FieldProvenance>;
      if (fp.perceivedQuality === "manual" || fp.preRoutine === "manual" || fp.notes === "manual") {
        return true;
      }
    } catch { /* fall through */ }
  }

  // Fallback: check source + non-null subjective fields
  if (!isWearableSource(existing.source)) {
    return existing.perceivedQuality != null || existing.preRoutine != null || existing.notes != null;
  }

  return false;
}

/** Safely parse fieldProvenance JSON string */
export function safeParseProvenance(raw: string | null): Partial<FieldProvenance> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<FieldProvenance>;
  } catch {
    return {};
  }
}

/** Safely parse merge log JSON, returning empty array on failure */
function safeParseMergeLog(raw: string): MergeLogEntry[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Serializable transaction helper ───────────────────────────────

/** Max number of retries after the initial attempt (total attempts = MAX_RETRIES + 1) */
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 100;

/**
 * Execute a Prisma interactive transaction with Serializable isolation
 * and automatic retry on P2034 (write conflict / serialization failure).
 * Total attempts: 3 (1 initial + 2 retries).
 *
 * This prevents the prefetch-outside-tx race condition flagged in audit.
 */
export async function withSerializableTransaction<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { $transaction: (...args: any[]) => any },
  fn: (tx: unknown) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (err: unknown) {
      const isPrismaConflict =
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2034";

      if (isPrismaConflict && attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 50;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  // unreachable
  throw new Error("Transaction failed after max retries");
}

// ── Shared wearable merge loop ────────────────────────────────────

/** Incoming night for the shared merge loop (already normalized by each parser) */
export interface WearableNight {
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
  awakeMinutes: number;
  hrv?: number | null;
  heartRate?: number | null;
  hasStages: boolean;
  providerRecordId?: string;
}

/** Select clause for merge-related queries */
export const MERGE_SELECT = {
  id: true, bedtime: true, wakeTime: true, bedtimeAt: true, wakeTimeAt: true,
  totalHours: true, quality: true, perceivedQuality: true, awakenings: true,
  awakeMinutes: true, hrv: true, heartRate: true, excluded: true, source: true,
  fieldProvenance: true, providerRecordId: true, rawHash: true, preRoutine: true,
  notes: true, mergeLog: true, date: true,
} as const;

/**
 * Shared wearable merge loop — used by HAE webhook, browser import, and Health Connect.
 * Runs inside a Serializable transaction: read→match→reconcile→delete stale→upsert.
 *
 * This eliminates code duplication and drift between the three wearable import routes.
 */
export async function mergeWearableNights(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { $transaction: (...args: any[]) => any },
  userId: string,
  nights: WearableNight[],
  wearableSource: "hae" | "health_connect",
  importBatchId: string,
): Promise<void> {
  if (nights.length === 0) return;

  // Deterministic sort: date asc, bedtime asc (prevents order-dependent results)
  const sortedNights = [...nights].sort((a, b) =>
    a.date.localeCompare(b.date) || a.bedtime.localeCompare(b.bedtime),
  );

  const affectedDates = [...new Set(sortedNights.map((n) => n.date))];

  await withSerializableTransaction(prisma, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txPrisma = tx as any;

    const existingRecords = await txPrisma.sleepLog.findMany({
      where: { userId, date: { in: affectedDates } },
      select: MERGE_SELECT,
    });

    const consumedIds = new Set<string>();
    // Mutable working set — updated after each upsert for intra-batch dedup
    const workingByDate = new Map<string, ExistingRecord[]>();
    for (const rec of existingRecords) {
      const list = workingByDate.get(rec.date) || [];
      list.push(rec as ExistingRecord);
      workingByDate.set(rec.date, list);
    }

    for (const night of sortedNights) {
      const dateRecords = (workingByDate.get(night.date) || []).filter((r) => !consumedIds.has(r.id));
      const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(night.date, night.bedtime, night.wakeTime);

      const matchResult = findBestMatch(
        { bedtime: night.bedtime, bedtimeAt, wakeTimeAt },
        dateRecords,
      );

      const existingRecord = matchResult?.match as ExistingRecord | undefined ?? null;
      if (existingRecord) consumedIds.add(existingRecord.id);

      const rawHash = computeRawHash({
        date: night.date, bedtime: night.bedtime, wakeTime: night.wakeTime,
        totalHours: night.totalHours, quality: night.quality,
        awakenings: night.awakenings, awakeMinutes: night.awakeMinutes,
        hrv: night.hrv ?? null, heartRate: night.heartRate ?? null,
        hasStages: night.hasStages,
      });

      // Short-circuit: skip no-op reimport (identical rawHash = identical data)
      if (existingRecord?.rawHash === rawHash) {
        continue;
      }

      const reconciled = reconcileWearableIntoExisting(
        {
          bedtime: night.bedtime, wakeTime: night.wakeTime,
          totalHours: night.totalHours, quality: night.quality,
          awakenings: night.awakenings, awakeMinutes: night.awakeMinutes,
          hrv: night.hrv, heartRate: night.heartRate,
          hasStages: night.hasStages,
          providerRecordId: night.providerRecordId, rawHash,
        },
        existingRecord,
        night.date,
        wearableSource,
        importBatchId,
        matchResult?.overlapScore,
      );

      for (const op of reconciled.operations) {
        if (op.type === "delete") {
          await txPrisma.sleepLog.delete({ where: { id: op.id } });
        }
      }

      // Delete stale wearable records overlapping this night
      const staleWearable = dateRecords.filter(
        (r) => r.id !== existingRecord?.id && !consumedIds.has(r.id) &&
          isWearableSource(r.source) &&
          findBestMatch({ bedtime: night.bedtime, bedtimeAt, wakeTimeAt }, [r]) !== null,
      );
      for (const stale of staleWearable) {
        consumedIds.add(stale.id);
        await txPrisma.sleepLog.delete({ where: { id: stale.id } });
      }

      // Upsert and capture the real persisted record for intra-batch working set
      const persisted = await txPrisma.sleepLog.upsert({
        where: {
          userId_date_bedtime: { userId, date: night.date, bedtime: night.bedtime },
        },
        update: reconciled.data as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        create: { userId, date: night.date, ...reconciled.data } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        select: MERGE_SELECT,
      });

      // Update working set: replace matched record with the REAL persisted record
      // so subsequent nights can match against the updated state (not stale original)
      const updatedDateList = (workingByDate.get(night.date) || [])
        .filter((r) => r.id !== existingRecord?.id);
      updatedDateList.push(persisted as ExistingRecord);
      workingByDate.set(night.date, updatedDateList);
      // Un-consume: the persisted record replaces the matched one and must remain
      // matchable by subsequent nights in the same batch
      if (existingRecord) consumedIds.delete(existingRecord.id);
    }
  });
}

// ── Shared standalone HRV/HR enrichment ───────────────────────────

/**
 * Enrich existing SleepLogs with standalone HRV/HR data from wearable payloads.
 * Runs inside a Serializable transaction (race-safe read→modify→write).
 *
 * Fan-out fix: per date, only the LONGEST non-excluded sleep record is enriched
 * (canonical session), preventing HRV/HR from being replicated to naps or
 * split-sleep fragments.
 *
 * Also appends an "enrich_wearable_biometrics" entry to mergeLog for audit trail.
 */
export async function enrichStandaloneHrvHr(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { $transaction: (...args: any[]) => any },
  userId: string,
  hrvByDate: Map<string, number>,
  hrByDate: Map<string, number>,
  wearableSource: "hae" | "health_connect",
  importBatchId: string,
): Promise<number> {
  const allDates = [...new Set([...hrvByDate.keys(), ...hrByDate.keys()])];
  if (allDates.length === 0) return 0;

  return await withSerializableTransaction(prisma, async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txPrisma = tx as any;

    const existingLogs = await txPrisma.sleepLog.findMany({
      where: { userId, date: { in: allDates } },
      select: { id: true, date: true, totalHours: true, excluded: true, fieldProvenance: true, mergeLog: true },
    });

    // Pick canonical record per date: longest non-excluded session
    const canonicalByDate = new Map<string, typeof existingLogs[0]>();
    for (const log of existingLogs) {
      if (log.excluded) continue;
      const current = canonicalByDate.get(log.date);
      if (!current || log.totalHours > current.totalHours) {
        canonicalByDate.set(log.date, log);
      }
    }

    const enrichedDates = new Set<string>();

    for (const [date, log] of canonicalByDate) {
      const hrv = hrvByDate.get(date);
      const hr = hrByDate.get(date);
      const updateData: Record<string, unknown> = {};
      if (hrv !== undefined && hrv >= 1 && hrv <= 300) updateData.hrv = hrv;
      if (hr !== undefined && hr >= 20 && hr <= 250) updateData.heartRate = hr;

      if (Object.keys(updateData).length === 0) continue;

      // Update fieldProvenance atomically (read inside tx)
      const fp = safeParseProvenance(log.fieldProvenance);
      if (updateData.hrv !== undefined) fp.hrv = wearableSource;
      if (updateData.heartRate !== undefined) fp.heartRate = wearableSource;
      updateData.fieldProvenance = JSON.stringify(fp);

      // Append to mergeLog for audit trail
      const existingLog = log.mergeLog ? safeParseMergeLog(log.mergeLog) : [];
      const entry = createMergeLogEntry(
        "enrich_wearable_biometrics",
        wearableSource,
        undefined,
        undefined,
        [],
        Object.keys(updateData).filter((k) => k !== "fieldProvenance" && k !== "mergeLog"),
        `Standalone ${wearableSource} HRV/HR enrichment on canonical record for ${date}`,
        importBatchId,
      );
      updateData.mergeLog = JSON.stringify([...existingLog, entry]);

      await txPrisma.sleepLog.update({
        where: { id: log.id },
        data: updateData,
      });
      enrichedDates.add(date);
    }

    return enrichedDates.size;
  });
}

// ── Legacy compat: keep old exports for backward compat during migration ──
export { clockDistance as bedtimesOverlapDistance };
export function bedtimesOverlap(a: string, b: string, thresholdMin = 30): boolean {
  return clockDistance(a, b) <= thresholdMin;
}
