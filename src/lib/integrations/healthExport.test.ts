import { describe, it, expect } from "vitest";
import { parseHealthExportPayload, generateApiKey } from "./healthExport";

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
    expect(result[0].quality).toBe(3); // No stage breakdown → default 3
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
    // Deep+REM: 1h Deep + 1h REM + 1h REM = 3h out of 7.5h = 40% → quality 5
    expect(result[0].quality).toBe(5);
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

  it("skips entries without startDate/endDate", () => {
    const payload = {
      data: {
        metrics: [
          {
            name: "sleep_analysis",
            units: "hr",
            data: [
              { date: "2025-06-15", qty: 8 }, // aggregated format, no startDate
            ],
          },
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
});
