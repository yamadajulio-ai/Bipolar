import { describe, it, expect } from "vitest";
import {
  bedtimeToMinutes,
  clockDistance,
  bedtimesOverlap,
  computeAbsoluteTimestamps,
  intervalOverlap,
  findBestMatch,
  computeRawHash,
  buildProviderRecordId,
  reconcileManualIntoExisting,
  reconcileWearableIntoExisting,
  MERGE_ALGORITHM_VERSION,
  type ExistingRecord,
} from "./sleepMerge";

// ── Helpers ──────────────────────────────────────────────────────

function makeExistingRecord(overrides: Partial<ExistingRecord> = {}): ExistingRecord {
  return {
    id: "existing-1",
    bedtime: "23:00",
    wakeTime: "07:00",
    bedtimeAt: null,
    wakeTimeAt: null,
    totalHours: 8,
    quality: 70,
    perceivedQuality: null,
    awakenings: 2,
    awakeMinutes: 15,
    hrv: 45,
    heartRate: 58,
    excluded: false,
    source: "hae",
    fieldProvenance: null,
    providerRecordId: "hae:2026-03-25:23:00:Apple Watch",
    rawHash: "abc123def456",
    preRoutine: null,
    notes: null,
    mergeLog: null,
    ...overrides,
  };
}

// ── bedtimeToMinutes ─────────────────────────────────────────────

describe("bedtimeToMinutes", () => {
  it("converts midnight to 0", () => {
    expect(bedtimeToMinutes("00:00")).toBe(0);
  });

  it("converts 23:30 to 1410", () => {
    expect(bedtimeToMinutes("23:30")).toBe(23 * 60 + 30);
  });

  it("converts 07:15 to 435", () => {
    expect(bedtimeToMinutes("07:15")).toBe(7 * 60 + 15);
  });
});

// ── clockDistance ─────────────────────────────────────────────────

describe("clockDistance", () => {
  it("same time = 0", () => {
    expect(clockDistance("23:00", "23:00")).toBe(0);
  });

  it("20 minutes apart", () => {
    expect(clockDistance("22:40", "23:00")).toBe(20);
  });

  it("handles midnight crossing: 23:50 vs 00:10", () => {
    expect(clockDistance("23:50", "00:10")).toBe(20);
  });

  it("handles midnight crossing: 23:00 vs 00:30", () => {
    expect(clockDistance("23:00", "00:30")).toBe(90);
  });

  it("exact 30min boundary", () => {
    expect(clockDistance("22:30", "23:00")).toBe(30);
  });

  it("31 minutes apart", () => {
    expect(clockDistance("22:29", "23:00")).toBe(31);
  });

  it("large difference doesn't wrap wrong", () => {
    expect(clockDistance("10:00", "22:00")).toBe(720);
  });

  it("13h apart wraps to 11h", () => {
    expect(clockDistance("10:00", "23:00")).toBe(660);
  });
});

// ── bedtimesOverlap ──────────────────────────────────────────────

describe("bedtimesOverlap", () => {
  it("exact match → true", () => {
    expect(bedtimesOverlap("23:00", "23:00")).toBe(true);
  });

  it("within 30min → true", () => {
    expect(bedtimesOverlap("22:40", "23:00")).toBe(true);
  });

  it("exactly 30min → true", () => {
    expect(bedtimesOverlap("22:30", "23:00")).toBe(true);
  });

  it("31min apart → false", () => {
    expect(bedtimesOverlap("22:29", "23:00")).toBe(false);
  });

  it("midnight crossing within 30min → true", () => {
    expect(bedtimesOverlap("23:50", "00:10")).toBe(true);
  });

  it("midnight crossing over 30min → false", () => {
    expect(bedtimesOverlap("23:20", "00:00")).toBe(false);
  });

  it("custom threshold 60min", () => {
    expect(bedtimesOverlap("22:00", "23:00", 60)).toBe(true);
    expect(bedtimesOverlap("21:59", "23:00", 60)).toBe(false);
  });
});

// ── computeAbsoluteTimestamps ────────────────────────────────────

describe("computeAbsoluteTimestamps", () => {
  it("PM bedtime is previous day (overnight)", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "23:00", "07:00");
    // bedtime 23:00 on March 24 → +3h = 02:00 UTC on 25th
    expect(bedtimeAt.getUTCDate()).toBe(25);
    expect(wakeTimeAt.getUTCDate()).toBe(25);
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("AM bedtime (e.g., 01:00) is same day", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "01:00", "09:00");
    expect(bedtimeAt.getUTCHours()).toBe(4); // 01:00 + 3 = 04:00 UTC
    expect(wakeTimeAt.getUTCHours()).toBe(12); // 09:00 + 3 = 12:00 UTC
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("bedtime always < wakeTime for overnight", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "22:00", "06:00");
    expect(bedtimeAt.getTime()).toBeLessThan(wakeTimeAt.getTime());
  });

  it("daytime nap: 14:00→15:00 is same day (NOT previous day)", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "14:00", "15:00");
    // Both on March 25. 14:00 + 3 = 17:00 UTC, 15:00 + 3 = 18:00 UTC
    expect(bedtimeAt.getUTCDate()).toBe(25);
    expect(wakeTimeAt.getUTCDate()).toBe(25);
    expect(bedtimeAt.getUTCHours()).toBe(17);
    expect(wakeTimeAt.getUTCHours()).toBe(18);
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("noon bedtime to afternoon: 12:00→14:00 is same day", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "12:00", "14:00");
    expect(bedtimeAt.getUTCDate()).toBe(25);
    expect(wakeTimeAt.getUTCDate()).toBe(25);
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("midnight bedtime: 00:00→08:00 is same day", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "00:00", "08:00");
    expect(bedtimeAt.getUTCDate()).toBe(25);
    expect(wakeTimeAt.getUTCDate()).toBe(25);
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });
});

// ── intervalOverlap ──────────────────────────────────────────────

describe("intervalOverlap", () => {
  it("perfect overlap = 1", () => {
    const a = { bedtimeAt: new Date("2026-03-24T23:00Z"), wakeTimeAt: new Date("2026-03-25T07:00Z") };
    const b = { bedtimeAt: new Date("2026-03-24T23:00Z"), wakeTimeAt: new Date("2026-03-25T07:00Z") };
    expect(intervalOverlap(a, b)).toBe(1);
  });

  it("no overlap = 0", () => {
    const a = { bedtimeAt: new Date("2026-03-24T23:00Z"), wakeTimeAt: new Date("2026-03-25T07:00Z") };
    const b = { bedtimeAt: new Date("2026-03-25T12:00Z"), wakeTimeAt: new Date("2026-03-25T13:00Z") };
    expect(intervalOverlap(a, b)).toBe(0);
  });

  it("partial overlap", () => {
    const a = { bedtimeAt: new Date("2026-03-24T23:00Z"), wakeTimeAt: new Date("2026-03-25T07:00Z") };
    const b = { bedtimeAt: new Date("2026-03-25T02:00Z"), wakeTimeAt: new Date("2026-03-25T10:00Z") };
    const score = intervalOverlap(a, b);
    expect(score).toBeCloseTo(5 / 11, 2);
  });

  it("nap vs full night = no overlap", () => {
    const night = { bedtimeAt: new Date("2026-03-24T23:00Z"), wakeTimeAt: new Date("2026-03-25T07:00Z") };
    const nap = { bedtimeAt: new Date("2026-03-25T13:00Z"), wakeTimeAt: new Date("2026-03-25T14:00Z") };
    expect(intervalOverlap(night, nap)).toBe(0);
  });
});

// ── findBestMatch ────────────────────────────────────────────────

describe("findBestMatch", () => {
  it("returns null for empty candidates", () => {
    expect(findBestMatch({ bedtime: "23:00" }, [])).toBeNull();
  });

  it("returns null when no candidates within threshold", () => {
    const candidates = [{ bedtime: "20:00", bedtimeAt: null, wakeTimeAt: null }];
    expect(findBestMatch({ bedtime: "23:00" }, candidates)).toBeNull();
  });

  it("finds exact bedtime match", () => {
    const candidates = [
      { bedtime: "22:00", bedtimeAt: null, wakeTimeAt: null },
      { bedtime: "23:00", bedtimeAt: null, wakeTimeAt: null },
    ];
    const result = findBestMatch({ bedtime: "23:00" }, candidates);
    expect(result).not.toBeNull();
    expect(result!.match.bedtime).toBe("23:00");
    expect(result!.overlapScore).toBe(1);
  });

  it("finds closest bedtime match (clock-based)", () => {
    const candidates = [
      { bedtime: "22:00", bedtimeAt: null, wakeTimeAt: null },
      { bedtime: "22:50", bedtimeAt: null, wakeTimeAt: null },
    ];
    const result = findBestMatch({ bedtime: "23:00" }, candidates);
    expect(result).not.toBeNull();
    expect(result!.match.bedtime).toBe("22:50");
  });

  it("prefers interval overlap when timestamps available", () => {
    const a = {
      bedtime: "22:50",
      bedtimeAt: new Date("2026-03-24T01:50Z"),
      wakeTimeAt: new Date("2026-03-25T10:00Z"),
    };
    const b = {
      bedtime: "23:10",
      bedtimeAt: new Date("2026-03-25T02:10Z"),
      wakeTimeAt: new Date("2026-03-25T10:30Z"),
    };
    const result = findBestMatch(
      {
        bedtime: "23:00",
        bedtimeAt: new Date("2026-03-25T02:00Z"),
        wakeTimeAt: new Date("2026-03-25T10:00Z"),
      },
      [a, b],
    );
    expect(result).not.toBeNull();
    expect(result!.match.bedtime).toBe("23:10");
  });

  it("matches within 26 min boundary (clock-based, score > 0.1)", () => {
    // 26 min → score = 1 - (26/30) ≈ 0.133 — above the 0.1 minimum threshold
    const candidates = [{ bedtime: "22:34", bedtimeAt: null, wakeTimeAt: null }];
    const result = findBestMatch({ bedtime: "23:00" }, candidates);
    expect(result).not.toBeNull();
    expect(result!.match.bedtime).toBe("22:34");
  });

  it("rejects 28+ min distance (clock-based, score < 0.1)", () => {
    // 28 min → score = 1 - (28/30) = 0.067 — below 0.1 threshold
    const candidates = [{ bedtime: "22:32", bedtimeAt: null, wakeTimeAt: null }];
    const result = findBestMatch({ bedtime: "23:00" }, candidates);
    expect(result).toBeNull();
  });
});

// ── computeRawHash ───────────────────────────────────────────────

describe("computeRawHash", () => {
  it("produces consistent hash for same data", () => {
    const data = { date: "2026-03-25", bedtime: "23:00", totalHours: 8 };
    expect(computeRawHash(data)).toBe(computeRawHash(data));
  });

  it("different data produces different hash", () => {
    const a = { date: "2026-03-25", bedtime: "23:00" };
    const b = { date: "2026-03-25", bedtime: "22:00" };
    expect(computeRawHash(a)).not.toBe(computeRawHash(b));
  });

  it("returns 16-char hex string", () => {
    const hash = computeRawHash({ test: true });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("key order does not affect hash", () => {
    const a = { z: 1, a: 2 };
    const b = { a: 2, z: 1 };
    expect(computeRawHash(a)).toBe(computeRawHash(b));
  });

  it("nested objects are deep-canonicalized", () => {
    const a = { outer: { z: 1, a: 2 } };
    const b = { outer: { a: 2, z: 1 } };
    expect(computeRawHash(a)).toBe(computeRawHash(b));
  });

  it("different nested content produces different hash", () => {
    const a = { outer: { x: 1 } };
    const b = { outer: { x: 2 } };
    expect(computeRawHash(a)).not.toBe(computeRawHash(b));
  });
});

// ── buildProviderRecordId ────────────────────────────────────────

describe("buildProviderRecordId", () => {
  it("builds HAE ID with source app", () => {
    expect(buildProviderRecordId("hae", "2026-03-25", "23:00", "Apple Watch"))
      .toBe("hae:2026-03-25:23:00:Apple Watch");
  });

  it("builds HC ID without source app", () => {
    expect(buildProviderRecordId("health_connect", "2026-03-25", "23:00"))
      .toBe("health_connect:2026-03-25:23:00");
  });
});

// ── reconcileManualIntoExisting ──────────────────────────────────

describe("reconcileManualIntoExisting", () => {
  const manualInput = {
    bedtime: "23:00",
    wakeTime: "07:00",
    totalHours: 8,
    quality: 80,
    awakenings: 1,
    hrv: null,
    heartRate: null,
    preRoutine: '["meditation"]',
    notes: "Dormi bem",
  };

  it("pure manual (no existing) — sets all fields from manual", () => {
    const result = reconcileManualIntoExisting(manualInput, null, "2026-03-25");
    expect(result.data.source).toBe("manual");
    expect(result.data.quality).toBe(80);
    expect(result.data.perceivedQuality).toBe(80);
    expect(result.data.awakeMinutes).toBe(0);
    expect(result.data.hrv).toBeNull();
    expect(result.data.preRoutine).toBe('["meditation"]');
    expect(result.data.notes).toBe("Dormi bem");
    expect(result.mergeLogEntry.action).toBe("create");
  });

  it("manual into wearable — wearable timing+biometrics preserved, source stays wearable", () => {
    const existing = makeExistingRecord({
      source: "hae",
      bedtime: "22:58",
      wakeTime: "06:45",
      totalHours: 7.78,
      awakeMinutes: 25,
      hrv: 48,
      heartRate: 55,
      quality: 65,
    });

    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");

    // Wearable timing preserved (manual bedtime 23:00 is NOT used)
    expect(result.data.bedtime).toBe("22:58");
    expect(result.data.wakeTime).toBe("06:45");
    expect(result.data.totalHours).toBe(7.78);

    // Wearable biometrics preserved
    expect(result.data.awakeMinutes).toBe(25);
    expect(result.data.hrv).toBe(48);
    expect(result.data.heartRate).toBe(55);

    // Wearable quality preserved
    expect(result.data.quality).toBe(65);

    // Manual subjective wins
    expect(result.data.perceivedQuality).toBe(80);
    expect(result.data.preRoutine).toBe('["meditation"]');
    expect(result.data.notes).toBe("Dormi bem");

    // Source stays as wearable — manual is overlay, not ownership transfer
    expect(result.data.source).toBe("hae");
    expect(result.mergeLogEntry.action).toBe("merge_manual_into_wearable");
  });

  it("manual HRV/HR NEVER overrides wearable HRV/HR even if provided", () => {
    const existing = makeExistingRecord({
      source: "health_connect",
      hrv: 48,
      heartRate: 55,
    });

    const manualWithHrv = { ...manualInput, hrv: 99, heartRate: 99 };
    const result = reconcileManualIntoExisting(manualWithHrv, existing, "2026-03-25");

    expect(result.data.hrv).toBe(48);
    expect(result.data.heartRate).toBe(55);
  });

  it("P0-2 FIX: wearable → manual → manual preserves biometrics (no state machine bug)", () => {
    // Step 1: Wearable record exists
    const wearableRecord = makeExistingRecord({
      source: "hae",
      bedtime: "22:58",
      wakeTime: "06:45",
      totalHours: 7.78,
      awakeMinutes: 25,
      hrv: 48,
      heartRate: 55,
      quality: 65,
    });

    // Step 2: First manual overlay
    const firstOverlay = reconcileManualIntoExisting(manualInput, wearableRecord, "2026-03-25");
    expect(firstOverlay.data.source).toBe("hae"); // source stays wearable

    // Step 3: Second manual edit on the already-overlaid record
    const overlaidRecord = makeExistingRecord({
      ...wearableRecord,
      source: firstOverlay.data.source as string, // "hae" — NOT "manual"
      perceivedQuality: firstOverlay.data.perceivedQuality as number,
      preRoutine: firstOverlay.data.preRoutine as string,
      notes: firstOverlay.data.notes as string,
      fieldProvenance: firstOverlay.data.fieldProvenance as string,
      mergeLog: firstOverlay.data.mergeLog as string,
    });

    const secondEdit = reconcileManualIntoExisting(
      { ...manualInput, quality: 90, notes: "Editei de novo" },
      overlaidRecord,
      "2026-03-25",
    );

    // Biometrics STILL preserved after second edit
    expect(secondEdit.data.awakeMinutes).toBe(25);
    expect(secondEdit.data.hrv).toBe(48);
    expect(secondEdit.data.heartRate).toBe(55);
    expect(secondEdit.data.quality).toBe(65); // wearable quality preserved
    expect(secondEdit.data.perceivedQuality).toBe(90); // new manual quality
    expect(secondEdit.data.notes).toBe("Editei de novo");
    expect(secondEdit.data.source).toBe("hae"); // still wearable
  });

  it("P1-PROV-01 FIX: manual preserves wearable-enriched HRV/HR from standalone import", () => {
    // Scenario: manual record was enriched with HRV/HR from standalone HAE import
    // (fieldProvenance tracks the wearable source, but source is still "manual")
    const existing = makeExistingRecord({
      source: "manual",
      hrv: 45,
      heartRate: 62,
      awakeMinutes: 0,
      providerRecordId: null,
      rawHash: null,
      fieldProvenance: JSON.stringify({
        bedtime: "manual",
        wakeTime: "manual",
        totalHours: "manual",
        quality: "manual",
        awakenings: "manual",
        awakeMinutes: "manual",
        hrv: "hae",        // enriched by standalone HAE import
        heartRate: "hae",   // enriched by standalone HAE import
      }),
    });

    // Manual edit with no HRV/HR (typical from browser form)
    const manualNoHrv = { ...manualInput, hrv: null, heartRate: null };
    const result = reconcileManualIntoExisting(manualNoHrv, existing, "2026-03-25");

    // Wearable-enriched biometrics PRESERVED (not nulled out)
    expect(result.data.hrv).toBe(45);
    expect(result.data.heartRate).toBe(62);
    // Source stays manual (it's still a manual record, just enriched)
    expect(result.data.source).toBe("manual");
    // Provenance tracks the wearable source for biometrics
    expect(result.fieldProvenance.hrv).toBe("hae");
    expect(result.fieldProvenance.heartRate).toBe("hae");
    // fieldsKept includes the preserved biometrics
    expect(result.mergeLogEntry.fieldsKept).toContain("hrv");
    expect(result.mergeLogEntry.fieldsKept).toContain("heartRate");
  });

  it("P1-PROV-01: manual HRV/HR explicitly provided DOES override enriched values", () => {
    const existing = makeExistingRecord({
      source: "manual",
      hrv: 45,
      heartRate: 62,
      fieldProvenance: JSON.stringify({
        bedtime: "manual", wakeTime: "manual", totalHours: "manual",
        quality: "manual", awakenings: "manual", awakeMinutes: "manual",
        hrv: "hae", heartRate: "hae",
      }),
    });

    // Manual edit WITH explicit HRV/HR values
    const manualWithHrv = { ...manualInput, hrv: 55, heartRate: 70 };
    const result = reconcileManualIntoExisting(manualWithHrv, existing, "2026-03-25");

    // Manual values win when explicitly provided
    expect(result.data.hrv).toBe(55);
    expect(result.data.heartRate).toBe(70);
    expect(result.fieldProvenance.hrv).toBe("manual");
    expect(result.fieldProvenance.heartRate).toBe("manual");
  });

  it("manual into unknown_legacy — treated as pure manual", () => {
    const existing = makeExistingRecord({
      source: "unknown_legacy",
      hrv: null,
      heartRate: null,
      awakeMinutes: 0,
      providerRecordId: null,
      rawHash: null,
    });

    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.quality).toBe(80);
    expect(result.data.source).toBe("manual");
    expect(result.data.awakeMinutes).toBe(0);
  });

  it("preserves excluded flag from wearable record", () => {
    const existing = makeExistingRecord({ source: "hae", excluded: true });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.excluded).toBe(true);
  });

  it("preserves providerRecordId and rawHash from wearable record", () => {
    const existing = makeExistingRecord({
      source: "hae",
      providerRecordId: "hae:2026-03-25:22:58:Apple Watch",
      rawHash: "deadbeef12345678",
    });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.providerRecordId).toBe("hae:2026-03-25:22:58:Apple Watch");
    expect(result.data.rawHash).toBe("deadbeef12345678");
  });

  it("wearable base — no delete even when manual bedtime differs (timing preserved)", () => {
    const existing = makeExistingRecord({ bedtime: "22:30" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    // Wearable timing preserved → existing.bedtime is final → no delete
    expect(result.data.bedtime).toBe("22:30");
    expect(result.operations).toEqual([{ type: "upsert" }]);
  });

  it("pure manual — generates delete when bedtime changes", () => {
    const existing = makeExistingRecord({
      source: "manual",
      bedtime: "22:30",
      providerRecordId: null,
      rawHash: null,
    });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.bedtime).toBe("23:00"); // manual bedtime used
    expect(result.operations).toContainEqual({ type: "delete", id: "existing-1" });
    expect(result.operations).toContainEqual({ type: "upsert" });
  });

  it("no delete when bedtime matches", () => {
    const existing = makeExistingRecord({ bedtime: "23:00" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.operations).toEqual([{ type: "upsert" }]);
  });

  it("generates correct fieldProvenance for wearable overlay", () => {
    const existing = makeExistingRecord({ source: "hae" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    const fp = JSON.parse(result.data.fieldProvenance as string);
    expect(fp.bedtime).toBe("hae");
    expect(fp.wakeTime).toBe("hae");
    expect(fp.totalHours).toBe("hae");
    expect(fp.quality).toBe("hae");
    expect(fp.hrv).toBe("hae");
    expect(fp.heartRate).toBe("hae");
    expect(fp.awakenings).toBe("hae");
    expect(fp.awakeMinutes).toBe("hae");
    expect(fp.perceivedQuality).toBe("manual");
    expect(fp.preRoutine).toBe("manual");
    expect(fp.notes).toBe("manual");
  });

  it("fieldProvenance: null HRV/HR from wearable → provenance undefined (not lying)", () => {
    const existing = makeExistingRecord({ source: "hae", hrv: null, heartRate: null });
    const manualWithHrv = { ...manualInput, hrv: 50, heartRate: 60 };
    const result = reconcileManualIntoExisting(manualWithHrv, existing, "2026-03-25");
    const fp = JSON.parse(result.data.fieldProvenance as string);
    // Value is null (wearable wins), so provenance should be undefined
    expect(fp.hrv).toBeUndefined();
    expect(fp.heartRate).toBeUndefined();
    expect(result.data.hrv).toBeNull();
    expect(result.data.heartRate).toBeNull();
  });

  it("includes algorithmVersion in mergeLog", () => {
    const result = reconcileManualIntoExisting(manualInput, null, "2026-03-25");
    expect(result.mergeLogEntry.algorithmVersion).toBe(MERGE_ALGORITHM_VERSION);
  });

  it("passes overlapScore to merge log", () => {
    const existing = makeExistingRecord({ source: "hae" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25", undefined, 0.85);
    expect(result.mergeLogEntry.overlapScore).toBe(0.85);
  });

  it("accumulates merge history", () => {
    const priorLog = JSON.stringify([{
      ts: "2026-03-20T10:00:00Z",
      algorithmVersion: "1.0.0",
      action: "create",
      incomingSource: "hae",
      fieldsKept: [],
      fieldsOverwritten: ["all"],
      reason: "New wearable record",
    }]);
    const existing = makeExistingRecord({ source: "hae", mergeLog: priorLog });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.mergeLog.length).toBe(2);
    expect(result.mergeLog[0].algorithmVersion).toBe("1.0.0");
    expect(result.mergeLog[1].algorithmVersion).toBe(MERGE_ALGORITHM_VERSION);
  });

  it("computes bedtimeAt/wakeTimeAt", () => {
    const result = reconcileManualIntoExisting(manualInput, null, "2026-03-25");
    expect(result.data.bedtimeAt).toBeInstanceOf(Date);
    expect(result.data.wakeTimeAt).toBeInstanceOf(Date);
    expect((result.data.bedtimeAt as Date).getTime()).toBeLessThan((result.data.wakeTimeAt as Date).getTime());
  });
});

// ── reconcileWearableIntoExisting ────────────────────────────────

describe("reconcileWearableIntoExisting", () => {
  const wearableInput = {
    bedtime: "22:58",
    wakeTime: "06:45",
    totalHours: 7.78,
    quality: 72,
    awakenings: 3,
    awakeMinutes: 18,
    hrv: 45,
    heartRate: 56,
    hasStages: true,
    providerRecordId: "hae:2026-03-25:22:58:Apple Watch",
    rawHash: "abc123",
  };

  it("pure wearable (no existing) — creates all fields", () => {
    const result = reconcileWearableIntoExisting(wearableInput, null, "2026-03-25", "hae");
    expect(result.data.source).toBe("hae");
    expect(result.data.quality).toBe(72);
    expect(result.data.perceivedQuality).toBeNull();
    expect(result.data.awakeMinutes).toBe(18);
    expect(result.data.providerRecordId).toBe("hae:2026-03-25:22:58:Apple Watch");
    expect(result.mergeLogEntry.action).toBe("create");
  });

  it("wearable into manual — preserves manual subjective data", () => {
    const existing = makeExistingRecord({
      source: "manual",
      quality: 80,
      perceivedQuality: 80,
      preRoutine: '["reading"]',
      notes: "Noite tranquila",
      excluded: true,
      providerRecordId: null,
      rawHash: null,
      fieldProvenance: JSON.stringify({ perceivedQuality: "manual", preRoutine: "manual" }),
    });

    const result = reconcileWearableIntoExisting(wearableInput, existing, "2026-03-25", "hae");

    // Wearable wins timing/biometrics
    expect(result.data.bedtime).toBe("22:58");
    expect(result.data.awakeMinutes).toBe(18);
    expect(result.data.hrv).toBe(45);
    expect(result.data.heartRate).toBe(56);

    // Manual wins subjective
    expect(result.data.perceivedQuality).toBe(80);
    expect(result.data.preRoutine).toBe('["reading"]');
    expect(result.data.notes).toBe("Noite tranquila");
    expect(result.data.excluded).toBe(true);

    // Quality: wearable-derived (hasStages=true)
    expect(result.data.quality).toBe(72);

    expect(result.mergeLogEntry.action).toBe("merge_wearable_into_manual");
    expect(result.mergeLogEntry.fieldsKept).toContain("perceivedQuality");
    expect(result.mergeLogEntry.fieldsKept).toContain("preRoutine");
  });

  it("wearable without stages — preserves manual quality as canonical", () => {
    const existing = makeExistingRecord({
      source: "manual",
      quality: 80,
      perceivedQuality: 80,
      providerRecordId: null,
      rawHash: null,
      fieldProvenance: JSON.stringify({ perceivedQuality: "manual" }),
    });

    const noStages = { ...wearableInput, hasStages: false, quality: 50 };
    const result = reconcileWearableIntoExisting(noStages, existing, "2026-03-25", "health_connect");

    expect(result.data.quality).toBe(80);
    expect(result.data.perceivedQuality).toBe(80);
  });

  it("reimport — preserves merged manual data from previous merge", () => {
    const existing = makeExistingRecord({
      source: "hae",
      quality: 72,
      perceivedQuality: 85,
      preRoutine: '["shower"]',
      notes: "Boa noite",
      fieldProvenance: JSON.stringify({
        bedtime: "hae", quality: "hae", perceivedQuality: "manual",
        preRoutine: "manual", notes: "manual",
      }),
    });

    const result = reconcileWearableIntoExisting(wearableInput, existing, "2026-03-25", "hae");
    expect(result.data.perceivedQuality).toBe(85);
    expect(result.data.preRoutine).toBe('["shower"]');
    expect(result.data.notes).toBe("Boa noite");
    expect(result.mergeLogEntry.fieldsKept).toContain("perceivedQuality");
  });

  it("generates delete when bedtime changes", () => {
    const existing = makeExistingRecord({ bedtime: "23:30" });
    const result = reconcileWearableIntoExisting(wearableInput, existing, "2026-03-25", "hae");
    expect(result.operations).toContainEqual({ type: "delete", id: "existing-1" });
  });

  it("sets providerRecordId and rawHash", () => {
    const result = reconcileWearableIntoExisting(wearableInput, null, "2026-03-25", "hae");
    expect(result.data.providerRecordId).toBe("hae:2026-03-25:22:58:Apple Watch");
    expect(result.data.rawHash).toBe("abc123");
  });

  it("preserves providerRecordId from existing when incoming has none", () => {
    const existing = makeExistingRecord({
      providerRecordId: "hae:2026-03-25:23:00:Apple Watch",
      rawHash: "existinghash123",
    });
    const noProvider = { ...wearableInput, providerRecordId: undefined, rawHash: undefined };
    const result = reconcileWearableIntoExisting(noProvider, existing, "2026-03-25", "hae");
    expect(result.data.providerRecordId).toBe("hae:2026-03-25:23:00:Apple Watch");
    expect(result.data.rawHash).toBe("existinghash123");
  });

  it("includes importBatchId in merge log", () => {
    const result = reconcileWearableIntoExisting(wearableInput, null, "2026-03-25", "hae", "batch_123");
    expect(result.mergeLogEntry.importBatchId).toBe("batch_123");
  });

  it("passes overlapScore to merge log", () => {
    const existing = makeExistingRecord();
    const result = reconcileWearableIntoExisting(wearableInput, existing, "2026-03-25", "hae", undefined, 0.92);
    expect(result.mergeLogEntry.overlapScore).toBe(0.92);
  });

  it("fieldProvenance tracks per-field source", () => {
    const existing = makeExistingRecord({
      source: "manual",
      perceivedQuality: 80,
      preRoutine: '["tea"]',
      providerRecordId: null,
      rawHash: null,
      fieldProvenance: JSON.stringify({ perceivedQuality: "manual", preRoutine: "manual" }),
    });

    const result = reconcileWearableIntoExisting(wearableInput, existing, "2026-03-25", "hae");
    const fp = JSON.parse(result.data.fieldProvenance as string);

    expect(fp.bedtime).toBe("hae");
    expect(fp.wakeTime).toBe("hae");
    expect(fp.awakeMinutes).toBe("hae");
    expect(fp.hrv).toBe("hae");
    expect(fp.heartRate).toBe("hae");
    expect(fp.perceivedQuality).toBe("manual");
    expect(fp.preRoutine).toBe("manual");
  });
});

// ── Edge cases: nap + night same day ─────────────────────────────

describe("nap + night same day", () => {
  it("nap and night have different bedtimes — no false match", () => {
    const night = { bedtime: "23:00", bedtimeAt: null, wakeTimeAt: null };
    const nap = { bedtime: "14:00", bedtimeAt: null, wakeTimeAt: null };
    const result = findBestMatch({ bedtime: "23:00" }, [nap, night]);
    expect(result!.match.bedtime).toBe("23:00");
  });

  it("nap has very different interval — no false match", () => {
    const napAt = {
      bedtime: "14:00",
      bedtimeAt: new Date("2026-03-25T17:00Z"),
      wakeTimeAt: new Date("2026-03-25T17:45Z"),
    };
    const nightAt = {
      bedtime: "23:00",
      bedtimeAt: new Date("2026-03-25T02:00Z"),
      wakeTimeAt: new Date("2026-03-25T10:00Z"),
    };
    const result = findBestMatch(
      { bedtime: "22:50", bedtimeAt: new Date("2026-03-25T01:50Z"), wakeTimeAt: new Date("2026-03-25T09:30Z") },
      [napAt, nightAt],
    );
    expect(result).not.toBeNull();
    expect(result!.match.bedtime).toBe("23:00");
  });
});

// ── Edge cases: nullability ──────────────────────────────────────

describe("nullability edge cases", () => {
  it("manual with null HRV/HR into wearable with null HRV/HR", () => {
    const existing = makeExistingRecord({ source: "hae", hrv: null, heartRate: null });
    const manual = {
      bedtime: "23:00", wakeTime: "07:00", totalHours: 8,
      quality: 80, awakenings: 0, hrv: null, heartRate: null,
      preRoutine: null, notes: null,
    };
    const result = reconcileManualIntoExisting(manual, existing, "2026-03-25");
    expect(result.data.hrv).toBeNull();
    expect(result.data.heartRate).toBeNull();
  });

  it("wearable with no HRV into manual with no HRV", () => {
    const existing = makeExistingRecord({
      source: "manual", hrv: null, heartRate: null,
      perceivedQuality: 70, providerRecordId: null, rawHash: null,
      fieldProvenance: JSON.stringify({ perceivedQuality: "manual" }),
    });
    const wearable = {
      bedtime: "23:00", wakeTime: "07:00", totalHours: 8,
      quality: 65, awakenings: 2, awakeMinutes: 10,
      hrv: undefined, heartRate: undefined, hasStages: false,
    };
    const result = reconcileWearableIntoExisting(wearable, existing, "2026-03-25", "health_connect");
    expect(result.data.hrv).toBeNull();
    expect(result.data.heartRate).toBeNull();
  });
});

// ── Legacy records ───────────────────────────────────────────────

describe("legacy records (source=unknown_legacy)", () => {
  it("wearable into unknown_legacy without subjective data — no preservation", () => {
    const existing = makeExistingRecord({
      source: "unknown_legacy",
      preRoutine: null,
      notes: null,
      perceivedQuality: null,
      fieldProvenance: null,
      providerRecordId: null,
      rawHash: null,
    });
    const wearable = {
      bedtime: "23:00", wakeTime: "07:00", totalHours: 8,
      quality: 72, awakenings: 2, awakeMinutes: 10,
      hasStages: true,
    };
    const result = reconcileWearableIntoExisting(wearable, existing, "2026-03-25", "hae");
    expect(result.data.perceivedQuality).toBeNull();
    expect(result.data.quality).toBe(72);
    expect(result.mergeLogEntry.action).toBe("update_wearable");
  });

  it("manual into unknown_legacy — treated as pure manual update", () => {
    const existing = makeExistingRecord({
      source: "unknown_legacy",
      hrv: null, heartRate: null, awakeMinutes: 0,
      providerRecordId: null, rawHash: null,
    });
    const manual = {
      bedtime: "23:00", wakeTime: "07:00", totalHours: 8,
      quality: 80, awakenings: 0, hrv: null, heartRate: null,
      preRoutine: null, notes: null,
    };
    const result = reconcileManualIntoExisting(manual, existing, "2026-03-25");
    expect(result.data.quality).toBe(80);
    expect(result.data.source).toBe("manual");
    expect(result.mergeLogEntry.action).toBe("update_manual");
  });
});

// ── Full lifecycle: wearable → manual overlay → wearable reimport ──

describe("full lifecycle", () => {
  it("wearable → manual overlay → wearable reimport preserves all data", () => {
    // Step 1: Initial wearable import
    const wearable1 = reconcileWearableIntoExisting(
      {
        bedtime: "22:58", wakeTime: "06:45", totalHours: 7.78,
        quality: 72, awakenings: 3, awakeMinutes: 18,
        hrv: 45, heartRate: 56, hasStages: true,
        providerRecordId: "hae:2026-03-25:22:58", rawHash: "hash1",
      },
      null, "2026-03-25", "hae", "batch1",
    );
    expect(wearable1.data.source).toBe("hae");

    // Step 2: Manual overlay
    const afterWearable = makeExistingRecord({
      ...wearable1.data as Partial<ExistingRecord>,
      id: "rec-1",
      bedtimeAt: wearable1.data.bedtimeAt as Date,
      wakeTimeAt: wearable1.data.wakeTimeAt as Date,
    });
    const manualOverlay = reconcileManualIntoExisting(
      { bedtime: "23:00", wakeTime: "07:00", totalHours: 8, quality: 85, awakenings: 1, preRoutine: '["tea"]', notes: "Boa noite" },
      afterWearable, "2026-03-25",
    );
    expect(manualOverlay.data.source).toBe("hae"); // stays wearable
    expect(manualOverlay.data.perceivedQuality).toBe(85);
    expect(manualOverlay.data.hrv).toBe(45); // preserved

    // Step 3: Wearable reimport (same night, updated data)
    const afterOverlay = makeExistingRecord({
      ...manualOverlay.data as Partial<ExistingRecord>,
      id: "rec-1",
      bedtimeAt: manualOverlay.data.bedtimeAt as Date,
      wakeTimeAt: manualOverlay.data.wakeTimeAt as Date,
    });
    const reimport = reconcileWearableIntoExisting(
      {
        bedtime: "22:58", wakeTime: "06:50", totalHours: 7.87,
        quality: 74, awakenings: 2, awakeMinutes: 15,
        hrv: 47, heartRate: 55, hasStages: true,
        providerRecordId: "hae:2026-03-25:22:58", rawHash: "hash2",
      },
      afterOverlay, "2026-03-25", "hae", "batch2",
    );

    // Wearable data updated
    expect(reimport.data.totalHours).toBe(7.87);
    expect(reimport.data.hrv).toBe(47);
    expect(reimport.data.quality).toBe(74);
    // Manual subjective preserved from previous overlay
    expect(reimport.data.perceivedQuality).toBe(85);
    expect(reimport.data.preRoutine).toBe('["tea"]');
    expect(reimport.data.notes).toBe("Boa noite");
    // Merge log accumulated
    expect(reimport.mergeLog.length).toBe(3);
  });
});
