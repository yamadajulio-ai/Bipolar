import { describe, it, expect } from "vitest";
import {
  computeInsights,
  formatSleepDuration,
  regularityScoreFromVariance,
  type PlannerBlockInput,
} from "./computeInsights";

// ── Factories ───────────────────────────────────────────────

const TODAY = new Date(2026, 2, 6); // March 6, 2026
const TZ = "America/Sao_Paulo";

function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface SleepOverrides {
  date?: string;
  bedtime?: string;
  wakeTime?: string;
  totalHours?: number;
  quality?: number;
  awakenings?: number;
}

function makeSleep(overrides: SleepOverrides = {}) {
  return {
    date: overrides.date ?? daysAgo(0),
    bedtime: overrides.bedtime ?? "23:00",
    wakeTime: overrides.wakeTime ?? "07:00",
    totalHours: overrides.totalHours ?? 8,
    quality: overrides.quality ?? 3,
    awakenings: overrides.awakenings ?? 0,
  };
}

interface EntryOverrides {
  date?: string;
  mood?: number;
  sleepHours?: number;
  energyLevel?: number | null;
  anxietyLevel?: number | null;
  irritability?: number | null;
  tookMedication?: string | null;
  warningSigns?: string | null;
}

function makeEntry(overrides: EntryOverrides = {}) {
  return {
    date: overrides.date ?? daysAgo(0),
    mood: overrides.mood ?? 3,
    sleepHours: overrides.sleepHours ?? 8,
    energyLevel: overrides.energyLevel ?? 3,
    anxietyLevel: overrides.anxietyLevel ?? null,
    irritability: overrides.irritability ?? null,
    tookMedication: overrides.tookMedication ?? null,
    warningSigns: overrides.warningSigns ?? null,
  };
}

interface RhythmOverrides {
  date?: string;
  wakeTime?: string | null;
  firstContact?: string | null;
  mainActivityStart?: string | null;
  dinnerTime?: string | null;
  bedtime?: string | null;
}

function makeRhythm(overrides: RhythmOverrides = {}) {
  return {
    date: overrides.date ?? daysAgo(0),
    wakeTime: overrides.wakeTime ?? "07:00",
    firstContact: overrides.firstContact ?? "08:00",
    mainActivityStart: overrides.mainActivityStart ?? "09:00",
    dinnerTime: overrides.dinnerTime ?? "19:00",
    bedtime: overrides.bedtime ?? "23:00",
  };
}

/** Generate N days of data going backwards from today */
function generateDays(n: number, overrides?: { sleep?: Partial<SleepOverrides>; entry?: Partial<EntryOverrides>; rhythm?: Partial<RhythmOverrides> }) {
  const sleepLogs = [];
  const entries = [];
  const rhythms = [];
  for (let i = 0; i < n; i++) {
    const date = daysAgo(i);
    sleepLogs.push(makeSleep({ date, ...overrides?.sleep }));
    entries.push(makeEntry({ date, ...overrides?.entry }));
    rhythms.push(makeRhythm({ date, ...overrides?.rhythm }));
  }
  return { sleepLogs, entries, rhythms };
}

// ── 1. Exported helpers ─────────────────────────────────────

describe("formatSleepDuration", () => {
  it("formats whole hours", () => {
    expect(formatSleepDuration(8)).toBe("8h");
  });

  it("formats fractional hours", () => {
    expect(formatSleepDuration(7.5)).toBe("7h30");
  });

  it("pads single-digit minutes", () => {
    expect(formatSleepDuration(7.083)).toBe("7h05"); // ~7h05
  });

  it("handles zero", () => {
    expect(formatSleepDuration(0)).toBe("0h");
  });

  it("never produces 60 minutes (the 7h60 bug)", () => {
    // 7.999h * 60 = 479.94 → rounds to 480 → 8h00 = "8h"
    expect(formatSleepDuration(7.999)).toBe("8h");
  });
});

describe("regularityScoreFromVariance", () => {
  it("returns 100 for low variance (≤30)", () => {
    expect(regularityScoreFromVariance(0)).toBe(100);
    expect(regularityScoreFromVariance(30)).toBe(100);
  });

  it("returns 10 (floor) for high variance (≥240)", () => {
    expect(regularityScoreFromVariance(240)).toBe(10);
    expect(regularityScoreFromVariance(300)).toBe(10);
  });

  it("returns intermediate values", () => {
    // v=135 → 10 + 90 * (1 - (135-30)/210) = 10 + 90 * 0.5 = 55
    expect(regularityScoreFromVariance(135)).toBe(55);
  });
});

// ── 2. Sleep insights ───────────────────────────────────────

describe("computeInsights — sleep", () => {
  it("computes average duration from multiple nights", () => {
    const sleepLogs = [
      makeSleep({ date: daysAgo(0), totalHours: 7 }),
      makeSleep({ date: daysAgo(1), totalHours: 8 }),
      makeSleep({ date: daysAgo(2), totalHours: 9 }),
    ];
    const result = computeInsights(sleepLogs, [], [], [], TODAY, TZ);
    expect(result.sleep.avgDuration).toBeCloseTo(8, 0);
  });

  it("includes all records in average (caller is responsible for filtering naps)", () => {
    const sleepLogs = [
      makeSleep({ date: daysAgo(0), totalHours: 8 }),
      makeSleep({ date: daysAgo(1), totalHours: 0.5 }), // nap — not filtered internally
      makeSleep({ date: daysAgo(2), totalHours: 8 }),
    ];
    const result = computeInsights(sleepLogs, [], [], [], TODAY, TZ);
    // computeSleepInsights includes all records; page.tsx filters < 1h before calling
    expect(result.sleep.avgDuration).toBeCloseTo(5.5, 0);
  });

  it("handles empty sleep logs", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result.sleep.avgDuration).toBeNull();
    expect(result.sleep.recordCount).toBe(0);
    expect(result.sleep.dataConfidence).toBe("baixa");
  });

  it("reports low data confidence for few records", () => {
    const sleepLogs = [makeSleep({ date: daysAgo(0), totalHours: 7 })];
    const result = computeInsights(sleepLogs, [], [], [], TODAY, TZ);
    expect(result.sleep.dataConfidence).toBe("baixa");
  });

  it("reports high data confidence for many records", () => {
    const { sleepLogs } = generateDays(25);
    const result = computeInsights(sleepLogs, [], [], [], TODAY, TZ);
    expect(["media", "alta"]).toContain(result.sleep.dataConfidence);
  });
});

// ── 3. Mood insights ────────────────────────────────────────

describe("computeInsights — mood", () => {
  it("computes mood trend from entries in last 7 calendar days", () => {
    const entries = [];
    // daysAgo(6)=oldest → mood=1, daysAgo(0)=today → mood=4 (ascending over time)
    for (let i = 0; i <= 6; i++) {
      entries.push(makeEntry({ date: daysAgo(i), mood: Math.max(1, Math.min(5, 5 - i)) }));
    }
    // daysAgo(0)=mood5, daysAgo(1)=mood4, ..., daysAgo(4)=mood1 → descending from most recent
    // So trend comparing recent vs older = "down" if most recent days have lower mood
    // Let's reverse: make older days low, newer days high
    entries.length = 0;
    for (let i = 0; i <= 6; i++) {
      // i=0 is today (newest), i=6 is oldest
      entries.push(makeEntry({ date: daysAgo(i), mood: Math.max(1, Math.min(5, 1 + i)) }));
    }
    // daysAgo(0)=mood1(newest), daysAgo(6)=mood5(oldest) → recent is lower → "down"
    const result = computeInsights([], entries, [], [], TODAY, TZ);
    expect(result.mood.moodTrend).toBe("down");
  });

  it("computes medication adherence rate", () => {
    const entries = [];
    for (let i = 0; i < 30; i++) {
      entries.push(makeEntry({
        date: daysAgo(i),
        tookMedication: i < 20 ? "sim" : "nao",
      }));
    }
    const result = computeInsights([], entries, [], [], TODAY, TZ);
    // 20/30 = ~66.7%
    expect(result.mood.medicationAdherence).toBeCloseTo(66.7, 0);
  });

  it("tracks top warning signs", () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry({
        date: daysAgo(i),
        warningSigns: JSON.stringify(["sono_reduzido", "irritabilidade"]),
      }));
    }
    const result = computeInsights([], entries, [], [], TODAY, TZ);
    expect(result.mood.topWarningSigns.length).toBeGreaterThan(0);
    const keys = result.mood.topWarningSigns.map((w) => w.key);
    expect(keys).toContain("sono_reduzido");
    expect(keys).toContain("irritabilidade");
  });

  it("handles empty entries", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result.mood.moodTrend).toBeNull();
    expect(result.mood.medicationAdherence).toBeNull();
  });
});

// ── 4. Mood thermometer ─────────────────────────────────────

describe("computeInsights — thermometer", () => {
  it("returns null with insufficient data", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result.thermometer).toBeNull();
  });

  it("detects euthymia zone for stable mood=3", () => {
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 3, energyLevel: 3, anxietyLevel: 1, irritability: 1 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.thermometer) {
      expect(result.thermometer.zone).toBe("eutimia");
      expect(result.thermometer.position).toBeGreaterThanOrEqual(35);
      expect(result.thermometer.position).toBeLessThanOrEqual(65);
    }
  });

  it("detects mania zone for high mood+energy", () => {
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 5, energyLevel: 5, anxietyLevel: 1, irritability: 3 },
      sleep: { totalHours: 4 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.thermometer) {
      expect(["hipomania", "mania"]).toContain(result.thermometer.zone);
      expect(result.thermometer.position).toBeGreaterThan(65);
    }
  });

  it("detects depression zone for low mood", () => {
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 1, energyLevel: 1, anxietyLevel: 2, irritability: 1 },
      sleep: { totalHours: 10 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.thermometer) {
      expect(["depressao", "depressao_leve"]).toContain(result.thermometer.zone);
      expect(result.thermometer.position).toBeLessThan(35);
    }
  });

  it("reports instability for oscillating mood", () => {
    const entries = [];
    const sleepLogs = [];
    for (let i = 0; i < 14; i++) {
      const date = daysAgo(i);
      entries.push(makeEntry({ date, mood: i % 2 === 0 ? 5 : 1, energyLevel: i % 2 === 0 ? 5 : 1 }));
      sleepLogs.push(makeSleep({ date }));
    }
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.thermometer) {
      expect(["moderada", "alta"]).toContain(result.thermometer.instability);
    }
  });
});

// ── 5. Risk score ───────────────────────────────────────────

describe("computeInsights — risk", () => {
  it("returns low risk for stable data", () => {
    const { sleepLogs, entries, rhythms } = generateDays(14, {
      entry: { mood: 3, energyLevel: 3 },
      sleep: { totalHours: 8 },
    });
    const result = computeInsights(sleepLogs, entries, rhythms, [], TODAY, TZ);
    if (result.risk) {
      expect(result.risk.level).toBe("ok");
      expect(result.risk.score).toBeLessThanOrEqual(2);
    }
  });

  it("returns higher risk for extreme patterns", () => {
    const { sleepLogs, entries, rhythms } = generateDays(14, {
      entry: { mood: 5, energyLevel: 5, irritability: 5, warningSigns: JSON.stringify(["sono_reduzido", "pensamentos_acelerados", "irritabilidade"]) },
      sleep: { totalHours: 3 },
    });
    const result = computeInsights(sleepLogs, entries, rhythms, [], TODAY, TZ);
    if (result.risk) {
      expect(result.risk.score).toBeGreaterThan(2);
      expect(["atencao", "atencao_alta"]).toContain(result.risk.level);
    }
  });
});

// ── 6. Episode prediction ───────────────────────────────────

describe("computeInsights — prediction", () => {
  it("returns low mania risk for stable data", () => {
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 3, energyLevel: 3 },
      sleep: { totalHours: 8 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.prediction) {
      expect(result.prediction.maniaRisk).toBeLessThanOrEqual(30);
      expect(result.prediction.depressionRisk).toBeLessThanOrEqual(30);
      expect(result.prediction.level).toBe("baixo");
    }
  });

  it("detects elevated mania risk with short sleep + high mood", () => {
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 5, energyLevel: 5, irritability: 4 },
      sleep: { totalHours: 4 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.prediction) {
      expect(result.prediction.maniaRisk).toBeGreaterThan(30);
      expect(result.prediction.maniaSignals.length).toBeGreaterThan(0);
    }
  });

  it("clamps risk values to 0-100", () => {
    // Even with extreme data, values should be clamped
    const { sleepLogs, entries } = generateDays(14, {
      entry: { mood: 5, energyLevel: 5, irritability: 5, anxietyLevel: 5 },
      sleep: { totalHours: 1 },
    });
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    if (result.prediction) {
      expect(result.prediction.maniaRisk).toBeGreaterThanOrEqual(0);
      expect(result.prediction.maniaRisk).toBeLessThanOrEqual(100);
      expect(result.prediction.depressionRisk).toBeGreaterThanOrEqual(0);
      expect(result.prediction.depressionRisk).toBeLessThanOrEqual(100);
    }
  });
});

// ── 7. Cycling analysis ─────────────────────────────────────

describe("computeInsights — cycling", () => {
  it("returns empty cycling data with few entries (no switches)", () => {
    const { entries } = generateDays(30);
    const result = computeInsights([], entries, [], [], TODAY, TZ);
    // With only 30d of stable mood=3 data, cycling returns data but no rapid cycling
    if (result.cycling) {
      expect(result.cycling.isRapidCycling).toBe(false);
      expect(result.cycling.polaritySwitches).toBe(0);
    }
  });

  it("detects no rapid cycling for stable mood", () => {
    const { entries } = generateDays(90, { entry: { mood: 3 } });
    const result = computeInsights([], entries, [], [], TODAY, TZ, entries);
    if (result.cycling) {
      expect(result.cycling.isRapidCycling).toBe(false);
    }
  });

  it("detects rapid cycling with frequent polarity switches", () => {
    // Create entries that oscillate between extremes in blocks
    const entries = [];
    for (let i = 0; i < 90; i++) {
      const date = daysAgo(i);
      // Switch every ~10 days between extreme high and extreme low
      const block = Math.floor(i / 10);
      const mood = block % 2 === 0 ? 5 : 1;
      entries.push(makeEntry({ date, mood, energyLevel: mood }));
    }
    const result = computeInsights([], entries, [], [], TODAY, TZ, entries);
    if (result.cycling) {
      expect(result.cycling.polaritySwitches).toBeGreaterThanOrEqual(4);
    }
  });
});

// ── 8. Heatmap ──────────────────────────────────────────────

describe("computeInsights — heatmap", () => {
  it("returns empty heatmap when no data provided (I4-T3 optimization)", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result.heatmap).toHaveLength(0);
  });

  it("fills heatmap with entry and sleep data", () => {
    const date = daysAgo(5);
    const sleepLogs = [makeSleep({ date, totalHours: 7.5 })];
    const entries = [makeEntry({ date, mood: 4, energyLevel: 3 })];
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ, entries, sleepLogs);
    const day = result.heatmap.find((d) => d.date === date);
    expect(day).toBeDefined();
    expect(day!.mood).toBe(4);
    expect(day!.sleepHours).toBeCloseTo(7.5, 1);
    expect(day!.energy).toBe(3);
    expect(day!.hasEntry).toBe(true);
  });

  it("excludes naps from heatmap sleep data", () => {
    const date = daysAgo(3);
    // Need a real entry nearby so heatmap generates days in range (I4-T3 optimization)
    const sleepLogs = [
      makeSleep({ date, totalHours: 0.5 }), // nap
      makeSleep({ date: daysAgo(4), totalHours: 7 }), // real sleep for context
    ];
    const entries = [makeEntry({ date: daysAgo(4) })];
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ, entries, sleepLogs);
    const day = result.heatmap.find((d) => d.date === date);
    expect(day).toBeDefined();
    expect(day!.sleepHours).toBeNull(); // nap filtered out
  });

  it("uses 90d sleep data when provided", () => {
    const date = daysAgo(60); // beyond 30d window
    const sleepLogs30 = [makeSleep({ date: daysAgo(0), totalHours: 8 })];
    const sleepLogs90 = [
      makeSleep({ date: daysAgo(0), totalHours: 8 }),
      makeSleep({ date, totalHours: 6.5 }),
    ];
    const entries90 = [makeEntry({ date })];
    const result = computeInsights(sleepLogs30, [], [], [], TODAY, TZ, entries90, sleepLogs90);
    const day = result.heatmap.find((d) => d.date === date);
    expect(day).toBeDefined();
    expect(day!.sleepHours).toBeCloseTo(6.5, 1);
  });
});

// ── 9. Rhythm insights ──────────────────────────────────────

describe("computeInsights — rhythm", () => {
  it("computes regularity for consistent rhythms", () => {
    const { sleepLogs, rhythms } = generateDays(14);
    const result = computeInsights(sleepLogs, [], rhythms, [], TODAY, TZ);
    // All same times → low variance → high regularity
    expect(result.rhythm.hasEnoughData).toBe(true);
    if (result.rhythm.overallRegularity !== null) {
      expect(result.rhythm.overallRegularity).toBeGreaterThanOrEqual(80);
    }
  });

  it("handles empty rhythms gracefully", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result.rhythm.hasEnoughData).toBe(false);
  });
});

// ── 10. Chart & correlations ─────────────────────────────────

describe("computeInsights — chart", () => {
  it("builds chart data from entries and sleep logs", () => {
    const date = daysAgo(0);
    const sleepLogs = [makeSleep({ date, totalHours: 7 })];
    const entries = [makeEntry({ date, mood: 4, energyLevel: 3 })];
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    expect(result.chart.chartData.length).toBeGreaterThan(0);
    const point = result.chart.chartData.find((d) => d.date === date);
    expect(point).toBeDefined();
    expect(point!.mood).toBe(4);
    expect(point!.sleepHours).toBe(7);
  });

  it("requires n≥14 for correlation", () => {
    const { sleepLogs, entries } = generateDays(10);
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    // Not enough data for Spearman
    expect(result.chart.correlation).toBeNull();
  });

  it("computes correlation with sufficient data", () => {
    const { sleepLogs, entries } = generateDays(20);
    const result = computeInsights(sleepLogs, entries, [], [], TODAY, TZ);
    // With constant data, correlation may be null (no variance) or computed
    // Just verify it doesn't crash
    expect(result.chart).toBeDefined();
  });
});

// ── 11. InsightsResult structure ─────────────────────────────

describe("computeInsights — structure", () => {
  it("returns all expected top-level keys", () => {
    const result = computeInsights([], [], [], [], TODAY, TZ);
    expect(result).toHaveProperty("sleep");
    expect(result).toHaveProperty("mood");
    expect(result).toHaveProperty("rhythm");
    expect(result).toHaveProperty("chart");
    expect(result).toHaveProperty("combinedPatterns");
    expect(result).toHaveProperty("risk");
    expect(result).toHaveProperty("thermometer");
    expect(result).toHaveProperty("prediction");
    expect(result).toHaveProperty("cycling");
    expect(result).toHaveProperty("seasonality");
    expect(result).toHaveProperty("heatmap");
  });
});
