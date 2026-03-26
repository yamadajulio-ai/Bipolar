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
    providerRecordId: null,
    rawHash: null,
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
    // 10:00 vs 22:00 = 12h = 720min, which is the boundary
    expect(clockDistance("10:00", "22:00")).toBe(720);
  });

  it("13h apart wraps to 11h", () => {
    // 10:00 vs 23:00 = 13h → wraps to 11h = 660min
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
  it("PM bedtime is previous day", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "23:00", "07:00");
    // bedtime 23:00 on March 24, wake 07:00 on March 25
    expect(bedtimeAt.getUTCDate()).toBe(25); // 23:00 -03:00 = 02:00 UTC on 25th
    expect(wakeTimeAt.getUTCDate()).toBe(25); // 07:00 -03:00 = 10:00 UTC on 25th
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("AM bedtime (e.g., 01:00) is same day", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "01:00", "09:00");
    // bedtime 01:00 on March 25
    expect(bedtimeAt.getUTCHours()).toBe(4); // 01:00 + 3 = 04:00 UTC
    expect(wakeTimeAt.getUTCHours()).toBe(12); // 09:00 + 3 = 12:00 UTC
    expect(bedtimeAt < wakeTimeAt).toBe(true);
  });

  it("bedtime always < wakeTime", () => {
    const { bedtimeAt, wakeTimeAt } = computeAbsoluteTimestamps("2026-03-25", "22:00", "06:00");
    expect(bedtimeAt.getTime()).toBeLessThan(wakeTimeAt.getTime());
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
    // overlap = 5h (02:00-07:00), union = 11h (23:00-10:00)
    const score = intervalOverlap(a, b);
    expect(score).toBeCloseTo(5 / 11, 2);
  });

  it("nap vs full night = low overlap", () => {
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
    expect(result!.match.bedtime).toBe("23:10"); // closer interval overlap
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

  it("manual into wearable — wearable wins biometrics (HRV/HR/awakeMinutes), manual wins subjective", () => {
    const existing = makeExistingRecord({
      source: "hae",
      awakeMinutes: 25,
      hrv: 48,
      heartRate: 55,
      quality: 65, // wearable-derived quality
    });

    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");

    // Wearable ALWAYS wins biometrics
    expect(result.data.awakeMinutes).toBe(25);
    expect(result.data.hrv).toBe(48);
    expect(result.data.heartRate).toBe(55);

    // Manual wins subjective
    expect(result.data.perceivedQuality).toBe(80);
    expect(result.data.preRoutine).toBe('["meditation"]');
    expect(result.data.notes).toBe("Dormi bem");

    // Quality: preserved from wearable (derived)
    expect(result.data.quality).toBe(65);

    // Source = manual (user initiated)
    expect(result.data.source).toBe("manual");
    expect(result.mergeLogEntry.action).toBe("merge_manual_into_wearable");
    expect(result.mergeLogEntry.fieldsKept).toContain("hrv");
    expect(result.mergeLogEntry.fieldsKept).toContain("heartRate");
    expect(result.mergeLogEntry.fieldsKept).toContain("awakeMinutes");
  });

  it("manual HRV/HR NEVER overrides wearable HRV/HR even if provided", () => {
    const existing = makeExistingRecord({
      source: "health_connect",
      hrv: 48,
      heartRate: 55,
    });

    const manualWithHrv = { ...manualInput, hrv: 99, heartRate: 99 };
    const result = reconcileManualIntoExisting(manualWithHrv, existing, "2026-03-25");

    // Wearable ALWAYS wins — manual HRV/HR is ignored
    expect(result.data.hrv).toBe(48);
    expect(result.data.heartRate).toBe(55);
  });

  it("manual into unknown_legacy — treated as pure manual (no wearable data to preserve)", () => {
    const existing = makeExistingRecord({
      source: "unknown_legacy",
      hrv: null,
      heartRate: null,
      awakeMinutes: 0,
    });

    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.quality).toBe(80);
    expect(result.data.awakeMinutes).toBe(0);
  });

  it("preserves excluded flag from existing record", () => {
    const existing = makeExistingRecord({ source: "hae", excluded: true });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.data.excluded).toBe(true);
  });

  it("generates delete operation when bedtime changes", () => {
    const existing = makeExistingRecord({ bedtime: "22:30" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.operations).toContainEqual({ type: "delete", id: "existing-1" });
    expect(result.operations).toContainEqual({ type: "upsert" });
  });

  it("no delete when bedtime matches", () => {
    const existing = makeExistingRecord({ bedtime: "23:00" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    expect(result.operations).toEqual([{ type: "upsert" }]);
  });

  it("generates fieldProvenance JSON", () => {
    const existing = makeExistingRecord({ source: "hae" });
    const result = reconcileManualIntoExisting(manualInput, existing, "2026-03-25");
    const fp = JSON.parse(result.data.fieldProvenance as string);
    expect(fp.hrv).toBe("hae");
    expect(fp.heartRate).toBe("hae");
    expect(fp.perceivedQuality).toBe("manual");
    expect(fp.preRoutine).toBe("manual");
  });

  it("includes algorithmVersion in mergeLog", () => {
    const result = reconcileManualIntoExisting(manualInput, null, "2026-03-25");
    expect(result.mergeLogEntry.algorithmVersion).toBe(MERGE_ALGORITHM_VERSION);
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
      fieldProvenance: JSON.stringify({ perceivedQuality: "manual" }),
    });

    const noStages = { ...wearableInput, hasStages: false, quality: 50 };
    const result = reconcileWearableIntoExisting(noStages, existing, "2026-03-25", "health_connect");

    // Quality = manual's perceivedQuality (wearable has no stage data)
    expect(result.data.quality).toBe(80);
    expect(result.data.perceivedQuality).toBe(80);
  });

  it("reimport — preserves merged manual data from previous merge", () => {
    // Existing record was already merged (source=hae but has manual fieldProvenance)
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

    // Manual subjective preserved from PREVIOUS merge
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

  it("includes importBatchId in merge log", () => {
    const result = reconcileWearableIntoExisting(wearableInput, null, "2026-03-25", "hae", "batch_123");
    expect(result.mergeLogEntry.importBatchId).toBe("batch_123");
  });

  it("fieldProvenance tracks per-field source", () => {
    const existing = makeExistingRecord({
      source: "manual",
      perceivedQuality: 80,
      preRoutine: '["tea"]',
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
  it("nap and night have different bedtimes — no match", () => {
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
    expect(result!.match.bedtime).toBe("23:00"); // matches night, not nap
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
      perceivedQuality: 70, fieldProvenance: JSON.stringify({ perceivedQuality: "manual" }),
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
    });
    const manual = {
      bedtime: "23:00", wakeTime: "07:00", totalHours: 8,
      quality: 80, awakenings: 0, hrv: null, heartRate: null,
      preRoutine: null, notes: null,
    };
    const result = reconcileManualIntoExisting(manual, existing, "2026-03-25");
    expect(result.data.quality).toBe(80);
    expect(result.mergeLogEntry.action).toBe("update_manual");
  });
});
