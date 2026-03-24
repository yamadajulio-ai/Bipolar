import { describe, it, expect } from "vitest";
import {
  computeCurrentStreak,
  computeDisplayStreak,
  computeLongestStreak,
  computeAchievements,
} from "./streaks";
import type { StreakData } from "./streaks";

// ---------------------------------------------------------------------------
// Helper: isRealDate is not exported, so we test it indirectly via the
// public functions that call sanitizeDates → isRealDate.
// Invalid dates should be silently filtered out.
// ---------------------------------------------------------------------------

describe("isRealDate (tested indirectly)", () => {
  const TODAY = "2026-03-18";

  it("accepts valid dates", () => {
    expect(computeCurrentStreak(["2026-03-18"], TODAY)).toBe(1);
    expect(computeCurrentStreak(["2026-01-01"], "2026-01-01")).toBe(1);
    expect(computeCurrentStreak(["2025-12-31"], "2025-12-31")).toBe(1);
  });

  it("accepts Feb 29 on a leap year", () => {
    expect(computeCurrentStreak(["2024-02-29"], "2024-02-29")).toBe(1);
  });

  it("rejects Feb 29 on a non-leap year", () => {
    // 2025 is not a leap year — Feb 29 does not exist
    expect(computeCurrentStreak(["2025-02-29"], "2025-02-28")).toBe(0);
    expect(computeLongestStreak(["2025-02-29"])).toBe(0);
  });

  it("rejects Feb 31 (never valid)", () => {
    expect(computeLongestStreak(["2024-02-31"])).toBe(0);
  });

  it("rejects invalid months (month 13, month 00)", () => {
    expect(computeLongestStreak(["2025-13-01"])).toBe(0);
    expect(computeLongestStreak(["2025-00-15"])).toBe(0);
  });

  it("rejects empty string", () => {
    expect(computeLongestStreak([""])).toBe(0);
  });

  it("rejects wrong format (DD/MM/YYYY, partial, text)", () => {
    expect(computeLongestStreak(["15/03/2025"])).toBe(0);
    expect(computeLongestStreak(["2025-3-1"])).toBe(0);
    expect(computeLongestStreak(["hello"])).toBe(0);
    expect(computeLongestStreak(["2025-06"])).toBe(0);
  });

  it("filters invalid dates while keeping valid ones", () => {
    const dates = ["2026-03-18", "2025-02-29", "2026-03-17"];
    // Only the two valid dates remain, forming a 2-day streak
    expect(computeCurrentStreak(dates, TODAY)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeCurrentStreak
// ---------------------------------------------------------------------------

describe("computeCurrentStreak", () => {
  const TODAY = "2026-03-18";

  it("returns 0 for empty dates", () => {
    expect(computeCurrentStreak([], TODAY)).toBe(0);
  });

  it("returns 0 when today is invalid", () => {
    expect(computeCurrentStreak(["2026-03-18"], "not-a-date")).toBe(0);
  });

  it("returns 1 for a single day that is today", () => {
    expect(computeCurrentStreak(["2026-03-18"], TODAY)).toBe(1);
  });

  it("returns 0 for a single day that is NOT today", () => {
    expect(computeCurrentStreak(["2026-03-15"], TODAY)).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const dates = ["2026-03-18", "2026-03-17", "2026-03-16", "2026-03-15"];
    expect(computeCurrentStreak(dates, TODAY)).toBe(4);
  });

  it("stops counting when a gap is found", () => {
    // Gap between Mar 16 and Mar 14
    const dates = ["2026-03-18", "2026-03-17", "2026-03-16", "2026-03-14"];
    expect(computeCurrentStreak(dates, TODAY)).toBe(3);
  });

  it("returns 0 when today is not in the list (gap from today)", () => {
    const dates = ["2026-03-17", "2026-03-16", "2026-03-15"];
    expect(computeCurrentStreak(dates, TODAY)).toBe(0);
  });

  it("handles duplicate dates without double-counting", () => {
    const dates = [
      "2026-03-18",
      "2026-03-18",
      "2026-03-17",
      "2026-03-17",
      "2026-03-16",
    ];
    expect(computeCurrentStreak(dates, TODAY)).toBe(3);
  });

  it("handles unsorted input (uses Set lookup)", () => {
    const dates = ["2026-03-16", "2026-03-18", "2026-03-17"];
    expect(computeCurrentStreak(dates, TODAY)).toBe(3);
  });

  it("handles a long streak", () => {
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 2, 18 - i); // March 18 backwards
      dates.push(d.toISOString().slice(0, 10));
    }
    expect(computeCurrentStreak(dates, TODAY)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// computeDisplayStreak (grace window — domain rule for UI)
// ---------------------------------------------------------------------------

describe("computeDisplayStreak", () => {
  const TODAY = "2026-03-18";
  const YESTERDAY = "2026-03-17";

  it("returns 0 for empty dates", () => {
    expect(computeDisplayStreak([], TODAY)).toBe(0);
  });

  it("returns streak from today when today is in the set", () => {
    expect(computeDisplayStreak([TODAY, YESTERDAY, "2026-03-16"], TODAY)).toBe(3);
  });

  it("returns streak from yesterday when today is NOT yet recorded (grace)", () => {
    // User hasn't registered today yet — grace keeps the streak alive
    expect(computeDisplayStreak([YESTERDAY, "2026-03-16", "2026-03-15"], TODAY)).toBe(3);
  });

  it("returns 0 when neither today nor yesterday are in the set", () => {
    // Streak is genuinely broken — more than 1 day gap
    expect(computeDisplayStreak(["2026-03-15", "2026-03-14"], TODAY)).toBe(0);
  });

  it("returns 1 when only yesterday is in the set (grace preserves 1-day streak)", () => {
    expect(computeDisplayStreak([YESTERDAY], TODAY)).toBe(1);
  });

  it("returns 1 when only today is in the set", () => {
    expect(computeDisplayStreak([TODAY], TODAY)).toBe(1);
  });

  it("matches computeCurrentStreak when today IS in the set", () => {
    const dates = [TODAY, YESTERDAY, "2026-03-16"];
    expect(computeDisplayStreak(dates, TODAY)).toBe(computeCurrentStreak(dates, TODAY));
  });

  it("exceeds computeCurrentStreak when today is NOT in the set (grace)", () => {
    const dates = [YESTERDAY, "2026-03-16"];
    expect(computeDisplayStreak(dates, TODAY)).toBe(2);
    expect(computeCurrentStreak(dates, TODAY)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeLongestStreak
// ---------------------------------------------------------------------------

describe("computeLongestStreak", () => {
  it("returns 0 for empty dates", () => {
    expect(computeLongestStreak([])).toBe(0);
  });

  it("returns 1 for a single date", () => {
    expect(computeLongestStreak(["2026-03-10"])).toBe(1);
  });

  it("finds the longest of multiple streaks", () => {
    // Streak 1: Mar 1-3 (3 days)
    // Gap: Mar 4
    // Streak 2: Mar 5-10 (6 days) ← longest
    // Gap: Mar 11
    // Streak 3: Mar 12-13 (2 days)
    const dates = [
      "2026-03-01", "2026-03-02", "2026-03-03",
      "2026-03-05", "2026-03-06", "2026-03-07",
      "2026-03-08", "2026-03-09", "2026-03-10",
      "2026-03-12", "2026-03-13",
    ];
    expect(computeLongestStreak(dates)).toBe(6);
  });

  it("returns N for N all-consecutive days", () => {
    const dates = [
      "2026-03-01", "2026-03-02", "2026-03-03",
      "2026-03-04", "2026-03-05",
    ];
    expect(computeLongestStreak(dates)).toBe(5);
  });

  it("returns 1 when all dates have gaps between them", () => {
    const dates = ["2026-03-01", "2026-03-03", "2026-03-05", "2026-03-07"];
    expect(computeLongestStreak(dates)).toBe(1);
  });

  it("deduplicates dates before computing", () => {
    const dates = [
      "2026-03-01", "2026-03-01", "2026-03-02", "2026-03-02", "2026-03-03",
    ];
    expect(computeLongestStreak(dates)).toBe(3);
  });

  it("handles unsorted input", () => {
    const dates = ["2026-03-03", "2026-03-01", "2026-03-02"];
    expect(computeLongestStreak(dates)).toBe(3);
  });

  it("handles year boundary (Dec 31 → Jan 1)", () => {
    const dates = ["2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02"];
    expect(computeLongestStreak(dates)).toBe(4);
  });

  it("handles Feb 28 → Mar 1 (non-leap year)", () => {
    const dates = ["2025-02-27", "2025-02-28", "2025-03-01"];
    expect(computeLongestStreak(dates)).toBe(3);
  });

  it("handles Feb 28 → Feb 29 → Mar 1 (leap year)", () => {
    const dates = ["2024-02-28", "2024-02-29", "2024-03-01"];
    expect(computeLongestStreak(dates)).toBe(3);
  });

  it("returns 1 when all dates are the same (extreme dedup)", () => {
    const dates = ["2026-03-10", "2026-03-10", "2026-03-10", "2026-03-10"];
    expect(computeLongestStreak(dates)).toBe(1);
  });

  it("returns 2 for exactly two consecutive dates", () => {
    expect(computeLongestStreak(["2026-03-09", "2026-03-10"])).toBe(2);
  });

  it("returns 1 for exactly two non-consecutive dates", () => {
    expect(computeLongestStreak(["2026-03-08", "2026-03-10"])).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeAchievements
// ---------------------------------------------------------------------------

describe("computeAchievements", () => {
  function makeData(overrides: Partial<Omit<StreakData, "achievements">> = {}): Omit<StreakData, "achievements"> {
    return {
      checkinStreak: 0,
      sleepStreak: 0,
      bestCheckinStreak: 0,
      bestSleepStreak: 0,
      totalCheckins: 0,
      totalSleepLogs: 0,
      ...overrides,
    };
  }

  function findAchievement(achievements: ReturnType<typeof computeAchievements>, key: string) {
    return achievements.find((a) => a.key === key)!;
  }

  it("returns exactly 9 achievements", () => {
    const achievements = computeAchievements(makeData());
    expect(achievements).toHaveLength(9);
  });

  it("all achievements locked with zero data", () => {
    const achievements = computeAchievements(makeData());
    for (const a of achievements) {
      expect(a.unlocked).toBe(false);
    }
  });

  // --- first_checkin ---
  describe("first_checkin", () => {
    it("unlocks at totalCheckins >= 1", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 1 })), "first_checkin");
      expect(a.unlocked).toBe(true);
    });

    it("stays locked at totalCheckins 0", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 0 })), "first_checkin");
      expect(a.unlocked).toBe(false);
    });
  });

  // --- streak_3 ---
  describe("streak_3", () => {
    it("unlocks at bestCheckinStreak >= 3", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 3 })), "streak_3");
      expect(a.unlocked).toBe(true);
      expect(a.progress).toBe(1);
      expect(a.target).toBe(3);
    });

    it("shows partial progress at bestCheckinStreak 2", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 2 })), "streak_3");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(2 / 3);
    });
  });

  // --- streak_7 ---
  describe("streak_7", () => {
    it("unlocks at bestCheckinStreak >= 7", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 7 })), "streak_7");
      expect(a.unlocked).toBe(true);
      expect(a.target).toBe(7);
    });

    it("shows partial progress at bestCheckinStreak 5", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 5 })), "streak_7");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(5 / 7);
    });
  });

  // --- streak_14 ---
  describe("streak_14", () => {
    it("unlocks at bestCheckinStreak >= 14", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 14 })), "streak_14");
      expect(a.unlocked).toBe(true);
      expect(a.target).toBe(14);
    });

    it("capped at progress 1.0 even when bestCheckinStreak exceeds target", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 20 })), "streak_14");
      expect(a.unlocked).toBe(true);
      expect(a.progress).toBe(1);
    });
  });

  // --- streak_30 ---
  describe("streak_30", () => {
    it("unlocks at bestCheckinStreak >= 30", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 30 })), "streak_30");
      expect(a.unlocked).toBe(true);
      expect(a.target).toBe(30);
    });

    it("partial progress at 15", () => {
      const a = findAchievement(computeAchievements(makeData({ bestCheckinStreak: 15 })), "streak_30");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(0.5);
    });
  });

  // --- sleep_streak_7 ---
  describe("sleep_streak_7", () => {
    it("unlocks at bestSleepStreak >= 7", () => {
      const a = findAchievement(computeAchievements(makeData({ bestSleepStreak: 7 })), "sleep_streak_7");
      expect(a.unlocked).toBe(true);
      expect(a.target).toBe(7);
    });

    it("locked at bestSleepStreak 6", () => {
      const a = findAchievement(computeAchievements(makeData({ bestSleepStreak: 6 })), "sleep_streak_7");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(6 / 7);
    });
  });

  // --- total_30 ---
  describe("total_30", () => {
    it("unlocks at totalCheckins >= 30", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 30 })), "total_30");
      expect(a.unlocked).toBe(true);
      expect(a.progress).toBe(1);
      expect(a.target).toBe(30);
    });

    it("partial progress at 10", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 10 })), "total_30");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(10 / 30);
    });
  });

  // --- total_100 ---
  describe("total_100", () => {
    it("unlocks at totalCheckins >= 100", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 100 })), "total_100");
      expect(a.unlocked).toBe(true);
      expect(a.progress).toBe(1);
      expect(a.target).toBe(100);
    });

    it("partial progress at 50", () => {
      const a = findAchievement(computeAchievements(makeData({ totalCheckins: 50 })), "total_100");
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(0.5);
    });
  });

  // --- dual_streak_7 ---
  describe("dual_streak_7", () => {
    it("unlocks when BOTH current streaks >= 7", () => {
      const a = findAchievement(
        computeAchievements(makeData({ checkinStreak: 7, sleepStreak: 7 })),
        "dual_streak_7"
      );
      expect(a.unlocked).toBe(true);
      expect(a.progress).toBe(1);
      expect(a.target).toBe(7);
    });

    it("stays locked when only checkin streak >= 7", () => {
      const a = findAchievement(
        computeAchievements(makeData({ checkinStreak: 10, sleepStreak: 3 })),
        "dual_streak_7"
      );
      expect(a.unlocked).toBe(false);
      // Progress based on min(checkinStreak, sleepStreak) = 3
      expect(a.progress).toBeCloseTo(3 / 7);
    });

    it("stays locked when only sleep streak >= 7", () => {
      const a = findAchievement(
        computeAchievements(makeData({ checkinStreak: 2, sleepStreak: 10 })),
        "dual_streak_7"
      );
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBeCloseTo(2 / 7);
    });

    it("uses current streaks, not best streaks", () => {
      // Best streaks are high but current are low — should not unlock
      const a = findAchievement(
        computeAchievements(makeData({
          checkinStreak: 2,
          sleepStreak: 2,
          bestCheckinStreak: 30,
          bestSleepStreak: 30,
        })),
        "dual_streak_7"
      );
      expect(a.unlocked).toBe(false);
    });
  });

  // --- achievement metadata ---
  it("each achievement has key, label, description, icon", () => {
    const achievements = computeAchievements(makeData());
    for (const a of achievements) {
      expect(a.key).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.icon).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: computeStreakData-like scenario
// ---------------------------------------------------------------------------

describe("integration: realistic streak+achievement scenario", () => {
  it("computes streaks and achievements together from date arrays", () => {
    const today = "2026-03-18";

    // Simulate 10 consecutive checkin dates ending today
    const checkinDates: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(2026, 2, 18 - i);
      checkinDates.push(d.toISOString().slice(0, 10));
    }

    // Simulate 5 consecutive sleep dates ending today
    const sleepDates: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(2026, 2, 18 - i);
      sleepDates.push(d.toISOString().slice(0, 10));
    }

    const checkinStreak = computeCurrentStreak(checkinDates, today);
    const sleepStreak = computeCurrentStreak(sleepDates, today);
    const bestCheckinStreak = computeLongestStreak(checkinDates);
    const bestSleepStreak = computeLongestStreak(sleepDates);

    expect(checkinStreak).toBe(10);
    expect(sleepStreak).toBe(5);
    expect(bestCheckinStreak).toBe(10);
    expect(bestSleepStreak).toBe(5);

    const achievements = computeAchievements({
      checkinStreak,
      sleepStreak,
      bestCheckinStreak,
      bestSleepStreak,
      totalCheckins: checkinDates.length,
      totalSleepLogs: sleepDates.length,
    });

    // first_checkin: unlocked (totalCheckins = 10)
    expect(achievements.find((a) => a.key === "first_checkin")!.unlocked).toBe(true);
    // streak_3: unlocked (best = 10)
    expect(achievements.find((a) => a.key === "streak_3")!.unlocked).toBe(true);
    // streak_7: unlocked (best = 10)
    expect(achievements.find((a) => a.key === "streak_7")!.unlocked).toBe(true);
    // streak_14: locked (best = 10 < 14)
    expect(achievements.find((a) => a.key === "streak_14")!.unlocked).toBe(false);
    // sleep_streak_7: locked (best = 5 < 7)
    expect(achievements.find((a) => a.key === "sleep_streak_7")!.unlocked).toBe(false);
    // total_30: locked (10 < 30)
    expect(achievements.find((a) => a.key === "total_30")!.unlocked).toBe(false);
    // dual_streak_7: locked (sleepStreak = 5 < 7)
    expect(achievements.find((a) => a.key === "dual_streak_7")!.unlocked).toBe(false);
  });

  it("handles disjoint streaks: longest != current", () => {
    const today = "2026-03-18";

    // Old streak: Mar 1-8 (8 days), gap on Mar 9, then Mar 17-18 (2 days current)
    const dates = [
      "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
      "2026-03-05", "2026-03-06", "2026-03-07", "2026-03-08",
      "2026-03-17", "2026-03-18",
    ];

    const current = computeCurrentStreak(dates, today);
    const longest = computeLongestStreak(dates);

    expect(current).toBe(2);
    expect(longest).toBe(8);
  });
});
