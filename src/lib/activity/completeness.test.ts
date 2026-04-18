import { describe, it, expect } from "vitest";
import { computeDataCompleteness } from "./completeness";

describe("computeDataCompleteness", () => {
  it("returns 0 for empty input", () => {
    const r = computeDataCompleteness({
      hasSteps: false,
      stepCount: null,
      hasSleepLog: false,
      hasHrvOrHr: false,
      sessionCount: 0,
    });
    expect(r).toBe(0);
  });

  it("returns high completeness when all signals present and steps are high", () => {
    const r = computeDataCompleteness({
      hasSteps: true,
      stepCount: 8000,
      hasSleepLog: true,
      hasHrvOrHr: true,
      sessionCount: 2,
    });
    expect(r).toBeGreaterThanOrEqual(0.9);
  });

  it("penalizes suspiciously low step count", () => {
    const highSteps = computeDataCompleteness({
      hasSteps: true,
      stepCount: 5000,
      hasSleepLog: true,
      hasHrvOrHr: true,
      sessionCount: 0,
    });
    const lowSteps = computeDataCompleteness({
      hasSteps: true,
      stepCount: 100,
      hasSleepLog: true,
      hasHrvOrHr: true,
      sessionCount: 0,
    });
    expect(highSteps).toBeGreaterThan(lowSteps);
  });

  it("caps session signal so a single workout doesn't imply full wear-time", () => {
    const oneSession = computeDataCompleteness({
      hasSteps: false,
      stepCount: null,
      hasSleepLog: false,
      hasHrvOrHr: false,
      sessionCount: 1,
    });
    const manySessions = computeDataCompleteness({
      hasSteps: false,
      stepCount: null,
      hasSleepLog: false,
      hasHrvOrHr: false,
      sessionCount: 10,
    });
    // Both should be low-ish — session alone is worth 0.1 max
    expect(oneSession).toBeLessThan(0.2);
    expect(manySessions).toBeLessThan(0.2);
  });

  it("returns value in [0, 1]", () => {
    const r = computeDataCompleteness({
      hasSteps: true,
      stepCount: 100000,
      hasSleepLog: true,
      hasHrvOrHr: true,
      sessionCount: 100,
    });
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});
