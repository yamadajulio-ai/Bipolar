import { describe, it, expect } from "vitest";
import { parseHealthExportPayload, parseHealthExportPayloadV2, generateApiKey } from "./healthExport";

describe("generateApiKey", () => {
  it("returns a 64-character hex string", () => {
    const key = generateApiKey();
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
  });
});

describe("parseHealthExportPayload", () => {
  it("returns empty array for null/undefined input", () => {
    expect(parseHealthExportPayload(null)).toEqual([]);
    expect(parseHealthExportPayload(undefined)).toEqual([]);
  });

  it("returns empty array for malformed JSON", () => {
    expect(parseHealthExportPayload({})).toEqual([]);
    expect(parseHealthExportPayload({ data: {} })).toEqual([]);
    expect(parseHealthExportPayload({ data: { metrics: "not-array" } })).toEqual([]);
  });

  it("returns empty when no sleep_analysis metric", () => {
    const payload = {
      data: {
        metrics: [
          { name: "heart_rate", units: "bpm", data: [{ qty: 72, date: "2025-06-15" }] },
        ],
      },
    };
    expect(parseHealthExportPayload(payload)).toEqual([]);
  });

  it("parses a simple overnight sleep session", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              {
                startDate: "2025-06-14 23:00:00 -0300",
                endDate: "2025-06-15 07:00:00 -0300",
                value: "Asleep",
              },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(8);
    expect(result[0].bedtime).toBe("23:00");
    expect(result[0].wakeTime).toBe("07:00");
    expect(result[0].quality).toBe(50); // No stage breakdown → default 50
    expect(result[0].awakenings).toBe(0);
  });

  it("parses sleep with stage breakdown and estimates quality", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              { startDate: "2025-06-14 23:00:00 -0300", endDate: "2025-06-15 00:30:00 -0300", value: "Core" },
              { startDate: "2025-06-15 00:30:00 -0300", endDate: "2025-06-15 01:30:00 -0300", value: "Deep" },
              { startDate: "2025-06-15 01:30:00 -0300", endDate: "2025-06-15 02:30:00 -0300", value: "REM" },
              { startDate: "2025-06-15 02:30:00 -0300", endDate: "2025-06-15 03:00:00 -0300", value: "Awake" },
              { startDate: "2025-06-15 03:00:00 -0300", endDate: "2025-06-15 05:00:00 -0300", value: "Core" },
              { startDate: "2025-06-15 05:00:00 -0300", endDate: "2025-06-15 06:00:00 -0300", value: "REM" },
              { startDate: "2025-06-15 06:00:00 -0300", endDate: "2025-06-15 07:00:00 -0300", value: "Core" },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(1);
    // totalHours = bed→wake span: 23:00→07:00 = 8h (includes 30min awake)
    expect(result[0].totalHours).toBe(8);
    // Deep+REM: 1h Deep + 1h REM + 1h REM = 3h out of 8h = 37.5%
    // score = min(100, 0.375 * 280) = 100, + 5 bonus (≥7h) = 100, - 5 (1 awakening) = 95 → capped 100
    expect(result[0].quality).toBeGreaterThanOrEqual(90);
    expect(result[0].quality).toBeLessThanOrEqual(100);
    expect(result[0].awakenings).toBe(1);
  });

  it("counts awakenings correctly", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              { startDate: "2025-06-14 23:00:00 -0300", endDate: "2025-06-15 01:00:00 -0300", value: "Core" },
              { startDate: "2025-06-15 01:00:00 -0300", endDate: "2025-06-15 01:15:00 -0300", value: "Awake" },
              { startDate: "2025-06-15 01:15:00 -0300", endDate: "2025-06-15 04:00:00 -0300", value: "Core" },
              { startDate: "2025-06-15 04:00:00 -0300", endDate: "2025-06-15 04:10:00 -0300", value: "Awake" },
              { startDate: "2025-06-15 04:10:00 -0300", endDate: "2025-06-15 07:00:00 -0300", value: "Core" },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0].awakenings).toBe(2);
  });

  it("handles empty data array", () => {
    const payload = {
      data: {
        metrics: [
          { name: "sleep_analysis", units: "hr", data: [] },
        ],
      },
    };
    expect(parseHealthExportPayload(payload)).toEqual([]);
  });

  it("handles multiple nights in one payload", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              { startDate: "2025-06-14 23:00:00 -0300", endDate: "2025-06-15 07:00:00 -0300", value: "Asleep" },
              { startDate: "2025-06-15 23:00:00 -0300", endDate: "2025-06-16 06:30:00 -0300", value: "Asleep" },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(2);
    expect(result[0].totalHours).toBe(8);
    expect(result[1].totalHours).toBe(7.5);
  });

  it("detects sleep metric by content when name is missing", () => {
    const payload = {
      data: {
        metrics: [
          {
            units: "hr",
            data: [
              {
                startDate: "2025-06-14 23:00:00 -0300",
                endDate: "2025-06-15 07:00:00 -0300",
                value: "Núcleo",
                source: "Apple Watch",
              },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(8);
  });
});

describe("parseHealthExportPayloadV2", () => {
  it("returns empty result for null/undefined", () => {
    const result = parseHealthExportPayloadV2(null);
    expect(result.sleepNights).toEqual([]);
    expect(result.genericMetrics).toEqual([]);
    expect(result.hrvHrData.hrvByDate.size).toBe(0);
    expect(result.hrvHrData.hrByDate.size).toBe(0);
  });

  it("extracts HRV/HR data independently from sleep", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "heart_rate_variability",
            units: "ms",
            data: [
              { date: "2025-06-15 00:00:00 -0300", avg: 45 },
              { date: "2025-06-16 00:00:00 -0300", avg: 52 },
            ],
          },
          {
            name: "resting_heart_rate",
            units: "bpm",
            data: [
              { date: "2025-06-15 00:00:00 -0300", qty: 62 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.sleepNights).toHaveLength(0);
    expect(result.hrvHrData.hrvByDate.get("2025-06-15")).toBe(45);
    expect(result.hrvHrData.hrvByDate.get("2025-06-16")).toBe(52);
    expect(result.hrvHrData.hrByDate.get("2025-06-15")).toBe(62);
  });

  it("extracts steps metric", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2025-06-15 00:00:00 -0300", sum: 8500 },
              { date: "2025-06-16 00:00:00 -0300", sum: 12300 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(2);
    expect(result.genericMetrics[0].metric).toBe("steps");
    expect(result.genericMetrics[0].value).toBe(8500);
    expect(result.genericMetrics[0].unit).toBe("count");
  });

  it("dedupes multi-source steps by taking MAX per day (Apple Health parity)", () => {
    // Both iPhone and Apple Watch recorded the same day. Apple Health internally
    // deduplicates and shows a single canonical number (~7954). HAE exports both
    // sources — we must NOT sum (12954) or we double-count.
    const payload = {
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2025-06-15 00:00:00 -0300", sum: 5000, source: "iPhone" },
              { date: "2025-06-15 00:00:00 -0300", sum: 7954, source: "Apple Watch" },
            ],
          },
        ],
      },
    };
    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].value).toBe(7954);
  });

  it("sums intraday buckets from a single source", () => {
    // HAE can emit hourly buckets per source. Same source across the day must sum.
    const payload = {
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2025-06-15 08:00:00 -0300", sum: 1200, source: "iPhone" },
              { date: "2025-06-15 12:00:00 -0300", sum: 3100, source: "iPhone" },
              { date: "2025-06-15 19:00:00 -0300", sum: 2700, source: "iPhone" },
            ],
          },
        ],
      },
    };
    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].value).toBe(7000);
  });

  it("mixes intraday buckets per source and keeps the MAX source for the day", () => {
    // iPhone reports three buckets that sum to 9000, Watch reports one bucket of 7954.
    // We pick the higher source (iPhone), matching Apple Health's priority model.
    const payload = {
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2025-06-15 08:00:00 -0300", sum: 3000, source: "iPhone" },
              { date: "2025-06-15 12:00:00 -0300", sum: 4000, source: "iPhone" },
              { date: "2025-06-15 19:00:00 -0300", sum: 2000, source: "iPhone" },
              { date: "2025-06-15 00:00:00 -0300", sum: 7954, source: "Apple Watch" },
            ],
          },
        ],
      },
    };
    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].value).toBe(9000);
  });

  it("falls back to sum-all when no source metadata is present (backward compat)", () => {
    // Legacy payloads without source info collapse into a single bucket and sum —
    // preserves the pre-dedup behaviour so callers that never expose source keep working.
    const payload = {
      data: {
        metrics: [
          {
            name: "step_count",
            units: "count",
            data: [
              { date: "2025-06-15 08:00:00 -0300", sum: 1200 },
              { date: "2025-06-15 12:00:00 -0300", sum: 3100 },
              { date: "2025-06-15 19:00:00 -0300", sum: 2700 },
            ],
          },
        ],
      },
    };
    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].value).toBe(7000);
  });

  it("extracts active calories metric", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "active_energy",
            units: "kcal",
            data: [
              { date: "2025-06-15 00:00:00 -0300", sum: 450 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].metric).toBe("active_calories");
    expect(result.genericMetrics[0].value).toBe(450);
  });

  it("extracts Apple exercise time as exercise_minutes", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "apple_exercise_time",
            units: "min",
            data: [
              { date: "2025-06-15 00:00:00 -0300", sum: 32 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].metric).toBe("exercise_minutes");
    expect(result.genericMetrics[0].value).toBe(32);
    expect(result.genericMetrics[0].unit).toBe("min");
  });

  it("extracts blood oxygen metric (averaged)", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "blood_oxygen",
            units: "%",
            data: [
              { date: "2025-06-15 00:00:00 -0300", avg: 97 },
              { date: "2025-06-15 00:00:00 -0300", avg: 98 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].value).toBe(97.5);
    expect(result.genericMetrics[0].unit).toBe("%");
  });

  it("handles combined payload with sleep + steps + HRV", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              {
                startDate: "2025-06-14 23:00:00 -0300",
                endDate: "2025-06-15 07:00:00 -0300",
                value: "Asleep",
              },
            ],
          },
          {
            name: "step_count",
            units: "count",
            data: [{ date: "2025-06-15 00:00:00 -0300", sum: 10000 }],
          },
          {
            name: "heart_rate_variability",
            units: "ms",
            data: [{ date: "2025-06-15 00:00:00 -0300", avg: 48 }],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.sleepNights).toHaveLength(1);
    expect(result.sleepNights[0].hrv).toBe(48);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].metric).toBe("steps");
  });

  it("detects unnamed metrics by unit and value range", () => {
    const payload = {
      data: {
        metrics: [
          {
            // No name — detect by units "count" and plausible step values
            units: "count",
            data: [
              { date: "2025-06-15 00:00:00 -0300", sum: 7500 },
            ],
          },
          {
            // No name — detect by units "ms" and HRV range
            units: "ms",
            data: [
              { date: "2025-06-15 00:00:00 -0300", avg: 42 },
            ],
          },
        ],
      },
    };

    const result = parseHealthExportPayloadV2(payload);
    expect(result.hrvHrData.hrvByDate.get("2025-06-15")).toBe(42);
    expect(result.genericMetrics).toHaveLength(1);
    expect(result.genericMetrics[0].metric).toBe("steps");
    expect(result.genericMetrics[0].value).toBe(7500);
  });

  it("backward compatibility: parseHealthExportPayload still returns only sleep", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              {
                startDate: "2025-06-14 23:00:00 -0300",
                endDate: "2025-06-15 07:00:00 -0300",
                value: "Asleep",
              },
            ],
          },
          {
            name: "step_count",
            units: "count",
            data: [{ date: "2025-06-15 00:00:00 -0300", sum: 5000 }],
          },
        ],
      },
    };

    const result = parseHealthExportPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0].totalHours).toBe(8);
  });
});
