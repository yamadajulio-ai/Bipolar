import { describe, it, expect } from "vitest";
import { localDateStr, localToday, startOfDay, endOfDay } from "./dateUtils";

describe("localDateStr", () => {
  it("formats a regular date correctly", () => {
    const d = new Date(2025, 5, 15, 14, 30); // June 15, 2025 14:30
    expect(localDateStr(d)).toBe("2025-06-15");
  });

  it("pads single-digit month and day", () => {
    const d = new Date(2025, 0, 5, 10, 0); // Jan 5, 2025
    expect(localDateStr(d)).toBe("2025-01-05");
  });

  it("returns the local date even near midnight", () => {
    // 23:30 should still be today, not tomorrow
    const d = new Date(2025, 5, 15, 23, 30);
    expect(localDateStr(d)).toBe("2025-06-15");
  });

  it("handles midnight exactly as the start of the new day", () => {
    const d = new Date(2025, 5, 16, 0, 0, 0, 0); // midnight = June 16
    expect(localDateStr(d)).toBe("2025-06-16");
  });

  it("handles December 31 correctly", () => {
    const d = new Date(2025, 11, 31, 22, 0);
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
