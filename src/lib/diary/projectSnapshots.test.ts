import { describe, it, expect } from "vitest";
import { projectSnapshots, AGGREGATION_VERSION } from "./projectSnapshots";
import type { SnapshotInput } from "./projectSnapshots";

function makeSnapshot(overrides: Partial<SnapshotInput> & { capturedAt: Date }): SnapshotInput {
  return {
    feeling: null,
    mood: 3,
    energy: 3,
    anxiety: 2,
    irritability: 2,
    warningSignsNow: null,
    note: null,
    ...overrides,
  };
}

describe("projectSnapshots", () => {
  it("returns null for empty array", () => {
    expect(projectSnapshots([])).toBeNull();
  });

  it("single snapshot: correct values, null instability, null delta, 0 abrupt shifts", () => {
    const snap = makeSnapshot({ capturedAt: new Date("2026-03-22T10:00:00Z"), mood: 4, energy: 3, anxiety: 2, irritability: 1 });
    const result = projectSnapshots([snap])!;

    expect(result.mood).toBe(4);
    expect(result.energyLevel).toBe(3);
    expect(result.anxietyLevel).toBe(2);
    expect(result.irritability).toBe(1);
    expect(result.snapshotCount).toBe(1);
    expect(result.moodRange).toBe(0);
    expect(result.moodInstability).toBeNull();
    expect(result.morningEveningDelta).toBeNull();
    expect(result.abruptShifts).toBe(0);
    expect(result.aggregationVersion).toBe(AGGREGATION_VERSION);
  });

  it("two snapshots: latest wins, correct range, instability, delta", () => {
    const s1 = makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 2, energy: 2, anxiety: 4, irritability: 3 });
    const s2 = makeSnapshot({ capturedAt: new Date("2026-03-22T18:00:00Z"), mood: 4, energy: 4, anxiety: 1, irritability: 1 });
    const result = projectSnapshots([s2, s1])!; // out of order — should sort

    expect(result.mood).toBe(4); // latest
    expect(result.energyLevel).toBe(4);
    expect(result.moodRange).toBe(2); // 4 - 2
    expect(result.moodInstability).toBe(2); // |4-2| / 1
    expect(result.morningEveningDelta).toBe(2); // 4 - 2
    expect(result.anxietyPeak).toBe(4);
    expect(result.irritabilityPeak).toBe(3);
    expect(result.snapshotCount).toBe(2);
  });

  it("three snapshots with abrupt shift (1 -> 4 -> 3): abruptShifts = 1", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 1 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T13:00:00Z"), mood: 4 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), mood: 3 }),
    ];
    const result = projectSnapshots(snaps)!;

    expect(result.abruptShifts).toBe(1); // |4-1|=3 >=2 counts, |3-4|=1 <2 doesn't
    expect(result.moodRange).toBe(3);
    expect(result.morningEveningDelta).toBe(2); // 3 - 1
  });

  it("three snapshots with no abrupt shift (2 -> 3 -> 3): abruptShifts = 0", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 2 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T13:00:00Z"), mood: 3 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), mood: 3 }),
    ];
    const result = projectSnapshots(snaps)!;

    expect(result.abruptShifts).toBe(0);
  });

  it("warning signs union across snapshots (deduplication)", () => {
    const s1 = makeSnapshot({
      capturedAt: new Date("2026-03-22T08:00:00Z"),
      warningSignsNow: JSON.stringify(["isolamento", "irritabilidade_extrema"]),
    });
    const s2 = makeSnapshot({
      capturedAt: new Date("2026-03-22T18:00:00Z"),
      warningSignsNow: JSON.stringify(["isolamento", "gastos_impulsivos"]),
    });
    const result = projectSnapshots([s1, s2])!;

    const signs = JSON.parse(result.warningSigns!);
    expect(signs).toHaveLength(3);
    expect(signs).toContain("isolamento");
    expect(signs).toContain("irritabilidade_extrema");
    expect(signs).toContain("gastos_impulsivos");
  });

  it("note: latest non-null note wins", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), note: "Morning note" }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T13:00:00Z"), note: null }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), note: "Evening note" }),
    ];
    const result = projectSnapshots(snaps)!;
    expect(result.note).toBe("Evening note");
  });

  it("note: falls back to earlier non-null if latest is null", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), note: "Morning" }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), note: null }),
    ];
    const result = projectSnapshots(snaps)!;
    expect(result.note).toBe("Morning");
  });

  it("peaks: anxietyPeak and irritabilityPeak are max across all snapshots", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), anxiety: 2, irritability: 5 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T13:00:00Z"), anxiety: 5, irritability: 1 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), anxiety: 3, irritability: 3 }),
    ];
    const result = projectSnapshots(snaps)!;

    expect(result.anxietyPeak).toBe(5);
    expect(result.irritabilityPeak).toBe(5);
  });

  it("riskScoreCurrent computed from latest snapshot", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 5, energy: 5, irritability: 5 }), // high risk
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), mood: 3, energy: 3, irritability: 2 }), // low risk
    ];
    const result = projectSnapshots(snaps)!;

    // Latest (mood 3, energy 3, irrit 2) should have low risk
    expect(result.riskScoreCurrent).toBe(0);
    // Peak should be from first snapshot (mood 5 = +2, energy 5 = +1, irrit 5 = +1, mixed = +1)
    expect(result.riskScorePeak).toBeGreaterThan(result.riskScoreCurrent);
  });

  it("riskScorePeak is max across all snapshots", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 3, energy: 3, anxiety: 2, irritability: 2 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T13:00:00Z"), mood: 1, energy: 1, anxiety: 5, irritability: 5 }), // highest risk
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), mood: 3, energy: 3, anxiety: 3, irritability: 3 }),
    ];
    const result = projectSnapshots(snaps)!;

    // Middle snapshot (mood 1 = +2, energy 1 = +1, anxiety 5 = +1, irrit 5 = +1) = 5
    expect(result.riskScorePeak).toBeGreaterThanOrEqual(5);
    expect(result.riskScoreCurrent).toBeLessThan(result.riskScorePeak);
  });

  it("mood instability MASD calculation with 4 snapshots", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), mood: 1 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T11:00:00Z"), mood: 3 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T15:00:00Z"), mood: 2 }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), mood: 5 }),
    ];
    const result = projectSnapshots(snaps)!;

    // MASD: (|3-1| + |2-3| + |5-2|) / 3 = (2 + 1 + 3) / 3 = 2
    expect(result.moodInstability).toBe(2);
    expect(result.morningEveningDelta).toBe(4); // 5 - 1
    expect(result.abruptShifts).toBe(2); // |3-1|=2 >=2, |5-2|=3 >=2
  });

  it("handles malformed warningSignsNow gracefully", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z"), warningSignsNow: "not json" }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z"), warningSignsNow: JSON.stringify(["isolamento"]) }),
    ];
    const result = projectSnapshots(snaps)!;

    const signs = JSON.parse(result.warningSigns!);
    expect(signs).toEqual(["isolamento"]);
  });

  it("warningSigns is null when no snapshots have signs", () => {
    const snaps = [
      makeSnapshot({ capturedAt: new Date("2026-03-22T08:00:00Z") }),
      makeSnapshot({ capturedAt: new Date("2026-03-22T20:00:00Z") }),
    ];
    const result = projectSnapshots(snaps)!;

    expect(result.warningSigns).toBeNull();
  });

  it("firstSnapshotAt and lastSnapshotAt are correct", () => {
    const t1 = new Date("2026-03-22T06:00:00Z");
    const t2 = new Date("2026-03-22T22:00:00Z");
    const snaps = [
      makeSnapshot({ capturedAt: t2 }),
      makeSnapshot({ capturedAt: t1 }),
    ];
    const result = projectSnapshots(snaps)!;

    expect(result.firstSnapshotAt).toEqual(t1);
    expect(result.lastSnapshotAt).toEqual(t2);
  });
});
