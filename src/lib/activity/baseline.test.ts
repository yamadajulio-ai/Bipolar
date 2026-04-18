import { describe, it, expect } from "vitest";
import { computeBaseline28d, type DailyLoadPoint } from "./baseline";

function point(
  localDate: string,
  activityLoad: number,
  opts: Partial<DailyLoadPoint> = {},
): DailyLoadPoint {
  return {
    localDate,
    activityLoad,
    dataCompleteness: 0.9,
    dayOfWeek: 1,
    ...opts,
  };
}

describe("computeBaseline28d", () => {
  it("returns nulls when below MIN_DAYS_FOR_BASELINE (14 days)", () => {
    const history = Array.from({ length: 10 }, (_, i) => point(`2026-03-${10 + i}`, 50));
    const today = point("2026-03-20", 100);
    const r = computeBaseline28d(history, today);
    expect(r.baseline28d).toBeNull();
    expect(r.zScore).toBeNull();
    expect(r.sampleSize).toBe(10);
  });

  it("excludes low-completeness days from baseline", () => {
    const history = [
      ...Array.from({ length: 14 }, (_, i) =>
        point(`2026-03-${10 + i}`, 50, { dataCompleteness: 0.3 }),
      ), // all dropped (< 0.5)
      ...Array.from({ length: 5 }, (_, i) =>
        point(`2026-03-${24 + i}`, 80, { dataCompleteness: 0.9 }),
      ),
    ];
    const r = computeBaseline28d(history);
    // Only 5 eligible → still below threshold, nulls
    expect(r.baseline28d).toBeNull();
  });

  it("computes median + MAD when >= 14 eligible days", () => {
    const loads = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];
    const history = loads.map((l, i) => point(`2026-03-${10 + i}`, l));
    const r = computeBaseline28d(history);
    expect(r.baseline28d).not.toBeNull();
    // Median of [10..140] = 75
    expect(r.baseline28d).toBeCloseTo(75, 1);
    expect(r.baseline28dMad).toBeGreaterThan(0);
    expect(r.sampleSize).toBe(14);
  });

  it("computes positive zScore for above-baseline day", () => {
    const history = Array.from({ length: 20 }, (_, i) => point(`2026-03-${10 + i}`, 50));
    // With all values = 50, MAD = 0 → degenerate branch returns +3 for above baseline
    const today = point("2026-04-01", 100);
    const r = computeBaseline28d(history, today);
    expect(r.zScore).toBe(3);
  });

  it("computes negative zScore for below-baseline day", () => {
    const loads = [40, 45, 50, 50, 50, 55, 60, 50, 50, 45, 55, 50, 55, 45];
    const history = loads.map((l, i) => point(`2026-03-${10 + i}`, l));
    const today = point("2026-04-01", 20);
    const r = computeBaseline28d(history, today);
    expect(r.zScore).not.toBeNull();
    expect(r.zScore!).toBeLessThan(0);
  });

  it("segments weekend from weekday baseline when enough samples", () => {
    // 10 weekdays with load 30, 4 weekend days with load 100
    const weekdays = Array.from({ length: 10 }, (_, i) =>
      point(`2026-03-${10 + i}`, 30, { dayOfWeek: 2 }),
    );
    const weekends = Array.from({ length: 4 }, (_, i) =>
      point(`2026-04-${1 + i}`, 100, { dayOfWeek: 0 }),
    );
    const today = point("2026-04-12", 100, { dayOfWeek: 0 }); // Sunday
    const r = computeBaseline28d([...weekdays, ...weekends], today);
    // Today is weekend — baseline should lean toward 100, not 30
    expect(r.weekendAdjustedBaseline).toBeGreaterThan(50);
  });

  it("handles zero MAD gracefully (all same load)", () => {
    const history = Array.from({ length: 20 }, (_, i) => point(`2026-03-${10 + i}`, 50));
    const todayEqual = point("2026-04-01", 50);
    const r = computeBaseline28d(history, todayEqual);
    // Today equals baseline → zScore should be 0
    expect(r.zScore).toBe(0);
  });
});
