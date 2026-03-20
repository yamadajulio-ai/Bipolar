import { describe, it, expect } from "vitest";
import { localDateStr, localToday, startOfDay, endOfDay } from "./dateUtils";

describe("localDateStr", () => {
  it("formats a date in São Paulo timezone", () => {
    // June 15, 2025 18:00 UTC = June 15, 15:00 São Paulo
    const d = new Date("2025-06-15T18:00:00Z");
    expect(localDateStr(d)).toBe("2025-06-15");
  });

  it("pads single-digit month and day", () => {
    // Jan 5, 2025 15:00 UTC = Jan 5, 12:00 São Paulo
    const d = new Date("2025-01-05T15:00:00Z");
    expect(localDateStr(d)).toBe("2025-01-05");
  });

  it("rolls back date when UTC is next day but São Paulo is still today", () => {
    // June 16, 2025 01:30 UTC = June 15, 22:30 São Paulo (UTC-3)
    const d = new Date("2025-06-16T01:30:00Z");
    expect(localDateStr(d)).toBe("2025-06-15");
  });

  it("advances date when São Paulo crosses midnight", () => {
    // June 16, 2025 03:00 UTC = June 16, 00:00 São Paulo (midnight)
    const d = new Date("2025-06-16T03:00:00Z");
    expect(localDateStr(d)).toBe("2025-06-16");
  });

  it("handles December 31 correctly", () => {
    // Dec 31, 2025 23:00 UTC = Dec 31, 20:00 São Paulo
    const d = new Date("2025-12-31T23:00:00Z");
    expect(localDateStr(d)).toBe("2025-12-31");
  });

  it("handles year boundary (UTC Jan 1 but still Dec 31 in São Paulo)", () => {
    // Jan 1, 2026 02:00 UTC = Dec 31, 2025 23:00 São Paulo
    const d = new Date("2026-01-01T02:00:00Z");
    expect(localDateStr(d)).toBe("2025-12-31");
  });
});

describe("localToday", () => {
  it("returns a YYYY-MM-DD string", () => {
    const today = localToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("startOfDay", () => {
  it("returns midnight for a given YYYY-MM-DD", () => {
    const d = startOfDay("2025-06-15");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(5); // June = 5
    expect(d.getDate()).toBe(15);
  });
});

describe("endOfDay", () => {
  it("returns 23:59:59.999 for a given YYYY-MM-DD", () => {
    const d = endOfDay("2025-06-15");
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
    expect(d.getDate()).toBe(15);
  });
});
