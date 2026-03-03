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
    // Total sleep: 1.5h Core + 1h Deep + 1h REM + 2h Core + 1h REM + 1h Core = 7.5h
    expect(result[0].totalHours).toBe(7.5);
    // Deep+REM: 1h Deep + 1h REM + 1h REM = 3h out of 7.5h = 40%
    // score = min(100, 0.4 * 280) = 100, + 5 bonus (≥7h) = 100, - 5 (1 awakening) = 95 → capped 100
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
