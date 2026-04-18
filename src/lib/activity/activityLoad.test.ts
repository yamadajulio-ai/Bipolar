import { describe, it, expect } from "vitest";
import { computeDailyActivityLoad, type ActivitySessionInput } from "./activityLoad";

function session(overrides: Partial<ActivitySessionInput>): ActivitySessionInput {
  return {
    localDate: "2026-04-17",
    startAtUtc: new Date("2026-04-17T12:00:00Z"),
    endAtUtc: new Date("2026-04-17T12:30:00Z"),
    durationSec: 1800,
    intensityBand: "moderate",
    activityTypeNorm: "run",
    avgHr: 130,
    ...overrides,
  };
}

describe("computeDailyActivityLoad", () => {
  it("returns zero load when there are no sessions", () => {
    const r = computeDailyActivityLoad([], 1380); // 23:00 bedtime
    expect(r.activityLoad).toBe(0);
    expect(r.sessionMinutesLight).toBe(0);
    expect(r.sessionMinutesModerate).toBe(0);
    expect(r.sessionMinutesVigorous).toBe(0);
    expect(r.lateSessionMinutes).toBe(0);
    expect(r.lastSessionEndRelativeToHabitualSleepMin).toBeNull();
  });

  it("weights vigorous > moderate > light", () => {
    const light = computeDailyActivityLoad([session({ intensityBand: "light" })], null);
    const moderate = computeDailyActivityLoad([session({ intensityBand: "moderate" })], null);
    const vigorous = computeDailyActivityLoad([session({ intensityBand: "vigorous" })], null);
    expect(moderate.activityLoad).toBeGreaterThan(light.activityLoad);
    expect(vigorous.activityLoad).toBeGreaterThan(moderate.activityLoad);
    // 30min moderate = 2 × 30 = 60
    expect(moderate.activityLoad).toBeCloseTo(60, 1);
    // 30min vigorous = 3 × 30 = 90
    expect(vigorous.activityLoad).toBeCloseTo(90, 1);
  });

  it("does NOT apply lateness bonus to light activity (yoga/walk near bed)", () => {
    // Session ending 20:30 local, bedtime 21:00 — inside lateness window
    const lateYoga = session({
      intensityBand: "light",
      endAtUtc: new Date("2026-04-17T23:30:00Z"), // 20:30 America/Sao_Paulo (BRT -03:00)
    });
    const r = computeDailyActivityLoad([lateYoga], 21 * 60); // 21:00 bedtime = 1260 min
    // Light activity near bedtime gets no bonus — load = weight×duration only
    expect(r.activityLoad).toBeCloseTo(30, 1); // 1 × 30min
    expect(r.lateSessionMinutes).toBe(0);
  });

  it("applies lateness bonus to vigorous activity close to bedtime", () => {
    // Session ending 22:00 local, bedtime 23:00 → 60min before sleep (within 240min window)
    const lateRun = session({
      intensityBand: "vigorous",
      endAtUtc: new Date("2026-04-18T01:00:00Z"), // 22:00 America/Sao_Paulo
    });
    const early = session({
      intensityBand: "vigorous",
      endAtUtc: new Date("2026-04-17T15:00:00Z"), // 12:00 local — outside window
    });
    const lateResult = computeDailyActivityLoad([lateRun], 23 * 60);
    const earlyResult = computeDailyActivityLoad([early], 23 * 60);
    expect(lateResult.activityLoad).toBeGreaterThan(earlyResult.activityLoad);
    expect(lateResult.lateSessionMinutes).toBeGreaterThan(0);
  });

  it("skips lateness bonus when habitual sleep time is unknown", () => {
    const lateRun = session({
      intensityBand: "vigorous",
      endAtUtc: new Date("2026-04-18T01:00:00Z"),
    });
    const r = computeDailyActivityLoad([lateRun], null);
    expect(r.lateSessionMinutes).toBe(0);
    // Pure intensity × duration with no bonus
    expect(r.activityLoad).toBeCloseTo(90, 1);
  });

  it("accumulates minutes per intensity band", () => {
    const s1 = session({ intensityBand: "light", durationSec: 600 });   // 10min light
    const s2 = session({ intensityBand: "moderate", durationSec: 900 }); // 15min moderate
    const s3 = session({ intensityBand: "vigorous", durationSec: 1200 }); // 20min vigorous
    const r = computeDailyActivityLoad([s1, s2, s3], null);
    expect(r.sessionMinutesLight).toBe(10);
    expect(r.sessionMinutesModerate).toBe(15);
    expect(r.sessionMinutesVigorous).toBe(20);
  });

  it("defaults to moderate when intensityBand is missing", () => {
    const noBand = session({ intensityBand: undefined });
    const explicit = session({ intensityBand: "moderate" });
    const r1 = computeDailyActivityLoad([noBand], null);
    const r2 = computeDailyActivityLoad([explicit], null);
    expect(r1.activityLoad).toBeCloseTo(r2.activityLoad, 1);
  });
});
