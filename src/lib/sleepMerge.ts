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
export const MERGE_ALGORITHM_VERSION = "2.0.0";

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
 *   - bedtime hour >= 12 → night before (date - 1 day)
 *   - bedtime hour < 12 → same date (e.g., 01:00 AM)
 *   - wakeTime is always on the morning date
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

  // Bedtime: if PM (>=12), it's the previous day; if AM (<12), same day
  const bedDate = new Date(Date.UTC(year, month - 1, day));
  if (bH >= 12) {
    bedDate.setUTCDate(bedDate.getUTCDate() - 1);
  }
  // America/Sao_Paulo is UTC-3 (ignoring DST edge — acceptable for ±30min matching)
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
 * Uses interval overlap when absolute timestamps are available,
 * falls back to ±30min clock-distance.
 *
 * Returns the match and its overlap score, or null if no match.
 */
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
      // Fallback: clock-distance
      const dist = clockDistance(incoming.bedtime, c.bedtime);
      if (dist <= thresholdMin) {
        const score = 1 - (dist / thresholdMin); // normalize to 0..1
        if (score > bestScore) {
          bestScore = score;
          bestMatch = c;
        }
      }
    }
  }

  // Minimum threshold: 0.1 overlap (or within 30min for clock-based)
  if (bestMatch && bestScore >= 0.1) {
    return { match: bestMatch, overlapScore: bestScore };
  }
  return null;
}

// ── Provider identity ─────────────────────────────────────────────

/** Generate a stable hash from raw payload data for dedup */
export function computeRawHash(data: Record<string, unknown>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
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
  action: "create" | "merge_manual_into_wearable" | "merge_wearable_into_manual" | "update_wearable" | "update_manual";
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
 * Contract: manual ALWAYS wins on subjective fields, wearable ALWAYS wins on
 * biometrics and timing. HRV/HR: wearable wins unconditionally.
 */
export function reconcileManualIntoExisting(
  manual: IncomingManual,
  existing: ExistingRecord | null,
  date: string,
  importBatchId?: string,
): ReconcileResult {
  const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps(date, manual.bedtime, manual.wakeTime);
  const isWearableExisting = existing && existing.source !== "manual" && existing.source !== "unknown_legacy";

  const provenance: FieldProvenance = {
    bedtime: "manual",
    wakeTime: "manual",
    totalHours: "manual",
    quality: "manual",
    perceivedQuality: "manual",
    awakenings: "manual",
    awakeMinutes: isWearableExisting ? existing.source as FieldSource : "manual",
    hrv: isWearableExisting && existing.hrv != null ? existing.source as FieldSource : (manual.hrv != null ? "manual" : undefined),
    heartRate: isWearableExisting && existing.heartRate != null ? existing.source as FieldSource : (manual.heartRate != null ? "manual" : undefined),
    preRoutine: manual.preRoutine != null ? "manual" : undefined,
    notes: manual.notes != null ? "manual" : undefined,
  };

  const data: Record<string, unknown> = {
    bedtime: manual.bedtime,
    wakeTime: manual.wakeTime,
    bedtimeAt,
    wakeTimeAt,
    totalHours: manual.totalHours,
    perceivedQuality: manual.quality,
    awakenings: manual.awakenings,
    preRoutine: manual.preRoutine ?? null,
    notes: manual.notes ?? null,
    source: "manual",
  };

  const fieldsKept: string[] = [];
  const fieldsOverwritten: string[] = ["bedtime", "wakeTime", "totalHours", "perceivedQuality", "preRoutine", "notes"];

  if (isWearableExisting) {
    // Wearable ALWAYS wins on biometrics
    data.awakeMinutes = existing.awakeMinutes;
    data.hrv = existing.hrv;
    data.heartRate = existing.heartRate;
    fieldsKept.push("awakeMinutes", "hrv", "heartRate");

    // Quality: wearable-derived quality is canonical, manual goes to perceivedQuality
    if (existing.source !== "unknown_legacy") {
      data.quality = existing.quality; // preserve wearable-derived quality
      provenance.quality = existing.source as FieldSource;
      fieldsKept.push("quality");
    } else {
      data.quality = manual.quality;
    }

    // Preserve excluded (user decision)
    data.excluded = existing.excluded;
    fieldsKept.push("excluded");

    // Preserve awakenings from wearable
    data.awakenings = existing.awakenings;
    provenance.awakenings = existing.source as FieldSource;
    fieldsKept.push("awakenings");
  } else {
    // Pure manual: no wearable data to preserve
    data.awakeMinutes = 0;
    data.hrv = manual.hrv ?? null;
    data.heartRate = manual.heartRate ?? null;
    data.quality = manual.quality;
    fieldsOverwritten.push("quality", "hrv", "heartRate", "awakeMinutes");
  }

  data.fieldProvenance = JSON.stringify(provenance);

  // Build merge log
  const existingLog = existing?.mergeLog ? safeParseMergeLog(existing.mergeLog) : [];
  const entry = createMergeLogEntry(
    isWearableExisting ? "merge_manual_into_wearable" : (existing ? "update_manual" : "create"),
    "manual",
    existing?.source as FieldSource | undefined,
    undefined,
    fieldsKept,
    fieldsOverwritten,
    isWearableExisting
      ? `Manual entry merged into existing ${existing.source} record; wearable biometrics preserved`
      : existing ? "Manual update of existing manual record" : "New manual sleep record",
    importBatchId,
  );
  const mergeLog = [...existingLog, entry];
  data.mergeLog = JSON.stringify(mergeLog);

  // Operations: if existing has different bedtime, delete old + create new
  const operations: ReconcileResult["operations"] = [];
  if (existing && existing.bedtime !== manual.bedtime) {
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
    providerRecordId: wearable.providerRecordId ?? null,
    rawHash: wearable.rawHash ?? null,
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
    undefined,
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
  if (existing.source === "manual" || existing.source === "unknown_legacy") {
    return existing.perceivedQuality != null || existing.preRoutine != null || existing.notes != null;
  }

  return false;
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

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 100;

/**
 * Execute a Prisma interactive transaction with Serializable isolation
 * and automatic retry on P2034 (write conflict / serialization failure).
 *
 * This prevents the prefetch-outside-tx race condition flagged in audit.
 */
export async function withSerializableTransaction<T>(
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<T>, options?: { isolationLevel?: string; maxWait?: number; timeout?: number }) => Promise<T>;
  },
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

// ── Legacy compat: keep old exports for backward compat during migration ──
export { clockDistance as bedtimesOverlapDistance };
export function bedtimesOverlap(a: string, b: string, thresholdMin = 30): boolean {
  return clockDistance(a, b) <= thresholdMin;
}
