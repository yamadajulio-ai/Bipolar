import { describe, it, expect } from "vitest";
import { expandBlock, expandAllBlocks } from "./expandRecurrence";
import type { PlannerBlockData } from "./types";

// ── Helper to build test blocks ──────────────────────────────────────

function makeBlock(overrides: Partial<PlannerBlockData> = {}): PlannerBlockData {
  return {
    id: "block-1",
    title: "Test Block",
    category: "trabalho",
    kind: "FLEX",
    isRoutine: false,
    startAt: new Date("2025-06-02T09:00:00"), // Monday
    endAt: new Date("2025-06-02T10:00:00"),
    notes: null,
    energyCost: 3,
    stimulation: 1,
    recurrence: null,
    exceptions: [],
    ...overrides,
  };
}

function d(iso: string): Date {
  return new Date(iso);
}

// ── Single (non-recurring) blocks ────────────────────────────────────

describe("expandBlock — single event", () => {
  it("returns the block when it falls within the range", () => {
    const block = makeBlock();
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-02T23:59:59"));
    expect(occ).toHaveLength(1);
    expect(occ[0].title).toBe("Test Block");
    expect(occ[0].isRecurring).toBe(false);
  });

  it("returns empty when the block is outside the range", () => {
    const block = makeBlock();
    const occ = expandBlock(block, d("2025-06-03T00:00:00"), d("2025-06-03T23:59:59"));
    expect(occ).toHaveLength(0);
  });

  it("respects cancellation exception on a single block", () => {
    const block = makeBlock({
      exceptions: [
        {
          occurrenceDate: d("2025-06-02T12:00:00"),
          isCancelled: true,
          overrideStartAt: null,
          overrideEndAt: null,
          overrideTitle: null,
          overrideNotes: null,
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-02T23:59:59"));
    expect(occ).toHaveLength(0);
  });
});

// ── DAILY recurrence ─────────────────────────────────────────────────

describe("expandBlock — DAILY", () => {
  it("generates an occurrence every day (interval=1)", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    // Mon Jun 2 to Sun Jun 8 (7 days)
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    expect(occ).toHaveLength(7);
    expect(occ[0].occurrenceDate).toBe("2025-06-02");
    expect(occ[6].occurrenceDate).toBe("2025-06-08");
  });

  it("respects interval=2 (every other day)", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 2, weekDays: null, until: null },
    });
    // 7-day window starting from block's start day
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    // Days 0,2,4,6 from start → Jun 2, Jun 4, Jun 6, Jun 8
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.occurrenceDate)).toEqual([
      "2025-06-02",
      "2025-06-04",
      "2025-06-06",
      "2025-06-08",
    ]);
  });

  it("respects interval=3", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 3, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-11T23:59:59"));
    // Days 0,3,6,9 → Jun 2, Jun 5, Jun 8, Jun 11
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.occurrenceDate)).toEqual([
      "2025-06-02",
      "2025-06-05",
      "2025-06-08",
      "2025-06-11",
    ]);
  });

  it("respects until date", () => {
    const block = makeBlock({
      recurrence: {
        freq: "DAILY",
        interval: 1,
        weekDays: null,
        until: d("2025-06-04T23:59:59"),
      },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    expect(occ).toHaveLength(3); // Jun 2, 3, 4
  });

  it("preserves start and end times on each occurrence", () => {
    const block = makeBlock({
      startAt: d("2025-06-02T14:30:00"),
      endAt: d("2025-06-02T16:00:00"),
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-03T00:00:00"), d("2025-06-03T23:59:59"));
    expect(occ).toHaveLength(1);
    expect(occ[0].startAt.getHours()).toBe(14);
    expect(occ[0].startAt.getMinutes()).toBe(30);
    expect(occ[0].endAt.getHours()).toBe(16);
    expect(occ[0].endAt.getMinutes()).toBe(0);
  });
});

// ── WEEKLY recurrence ────────────────────────────────────────────────

describe("expandBlock — WEEKLY plain", () => {
  it("generates one occurrence per week on the same weekday", () => {
    const block = makeBlock({
      // Monday
      recurrence: { freq: "WEEKLY", interval: 1, weekDays: null, until: null },
    });
    // 3 weeks: Jun 2 (Mon) to Jun 22 (Sun)
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-22T23:59:59"));
    expect(occ).toHaveLength(3);
    // All should be Mondays
    for (const o of occ) {
      expect(new Date(o.startAt).getDay()).toBe(1); // Monday
    }
  });

  it("respects interval=2 (every other week)", () => {
    const block = makeBlock({
      recurrence: { freq: "WEEKLY", interval: 2, weekDays: null, until: null },
    });
    // 4 weeks: Jun 2 to Jun 29
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-29T23:59:59"));
    // Week 0 (Jun 2), skip week 1 (Jun 9), week 2 (Jun 16), skip week 3 (Jun 23)
    expect(occ).toHaveLength(2);
    expect(occ.map((o) => o.occurrenceDate)).toEqual(["2025-06-02", "2025-06-16"]);
  });
});

describe("expandBlock — WEEKLY with weekDays", () => {
  it("generates occurrences on specified weekdays", () => {
    const block = makeBlock({
      // Block starts on Monday
      recurrence: {
        freq: "WEEKLY",
        interval: 1,
        weekDays: "1,3,5", // Mon, Wed, Fri
        until: null,
      },
    });
    // 1 week
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    expect(occ).toHaveLength(3);
    expect(occ.map((o) => new Date(o.startAt).getDay())).toEqual([1, 3, 5]);
  });

  it("respects interval=2 with weekDays", () => {
    const block = makeBlock({
      recurrence: {
        freq: "WEEKLY",
        interval: 2,
        weekDays: "1,5", // Mon, Fri
        until: null,
      },
    });
    // 4 weeks: Jun 2 to Jun 29
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-29T23:59:59"));
    // Week 0: Mon Jun 2, Fri Jun 6
    // Week 1 (skip): Jun 9-15
    // Week 2: Mon Jun 16, Fri Jun 20
    // Week 3 (skip): Jun 23-29
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.occurrenceDate)).toEqual([
      "2025-06-02",
      "2025-06-06",
      "2025-06-16",
      "2025-06-20",
    ]);
  });
});

// ── Overnight blocks ─────────────────────────────────────────────────

describe("expandBlock — overnight", () => {
  it("handles blocks that cross midnight (e.g. 23:00-01:00)", () => {
    const block = makeBlock({
      startAt: d("2025-06-02T23:00:00"),
      endAt: d("2025-06-03T01:00:00"), // 2 hour duration crossing midnight
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-04T23:59:59"));
    // Should still produce an occurrence per day (anchored at start time)
    expect(occ.length).toBeGreaterThanOrEqual(3);
    // Each occurrence should have 2 hours duration
    for (const o of occ) {
      const durationMs = o.endAt.getTime() - o.startAt.getTime();
      expect(durationMs).toBe(2 * 60 * 60 * 1000);
    }
  });
});

// ── Exception handling ───────────────────────────────────────────────

describe("expandBlock — exceptions", () => {
  it("cancels a specific occurrence via isCancelled", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
      exceptions: [
        {
          occurrenceDate: d("2025-06-04T12:00:00"), // Wed
          isCancelled: true,
          overrideStartAt: null,
          overrideEndAt: null,
          overrideTitle: null,
          overrideNotes: null,
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-06T23:59:59"));
    expect(occ).toHaveLength(4); // 5 days minus 1 cancelled
    expect(occ.find((o) => o.occurrenceDate === "2025-06-04")).toBeUndefined();
  });

  it("overrides title on a specific occurrence", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
      exceptions: [
        {
          occurrenceDate: d("2025-06-03T12:00:00"),
          isCancelled: false,
          overrideStartAt: null,
          overrideEndAt: null,
          overrideTitle: "Custom Title",
          overrideNotes: null,
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-04T23:59:59"));
    const jun3 = occ.find((o) => o.occurrenceDate === "2025-06-03");
    expect(jun3?.title).toBe("Custom Title");
    // Other days should keep original title
    const jun2 = occ.find((o) => o.occurrenceDate === "2025-06-02");
    expect(jun2?.title).toBe("Test Block");
  });

  it("overrides start/end times on a specific occurrence", () => {
    const block = makeBlock({
      startAt: d("2025-06-02T09:00:00"),
      endAt: d("2025-06-02T10:00:00"),
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
      exceptions: [
        {
          occurrenceDate: d("2025-06-03T12:00:00"),
          isCancelled: false,
          overrideStartAt: d("2025-06-03T11:00:00"),
          overrideEndAt: d("2025-06-03T12:30:00"),
          overrideTitle: null,
          overrideNotes: null,
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-03T00:00:00"), d("2025-06-03T23:59:59"));
    expect(occ).toHaveLength(1);
    expect(occ[0].startAt.getHours()).toBe(11);
    expect(occ[0].endAt.getHours()).toBe(12);
    expect(occ[0].endAt.getMinutes()).toBe(30);
  });

  it("overrides notes (including empty string)", () => {
    const block = makeBlock({
      notes: "Original notes",
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
      exceptions: [
        {
          occurrenceDate: d("2025-06-03T12:00:00"),
          isCancelled: false,
          overrideStartAt: null,
          overrideEndAt: null,
          overrideTitle: null,
          overrideNotes: "", // Empty string should override
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-03T00:00:00"), d("2025-06-03T23:59:59"));
    expect(occ[0].notes).toBe(""); // Should be empty, not "Original notes"
  });

  it("preserves original notes when exception overrideNotes is null", () => {
    const block = makeBlock({
      notes: "Original notes",
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
      exceptions: [
        {
          occurrenceDate: d("2025-06-03T12:00:00"),
          isCancelled: false,
          overrideStartAt: null,
          overrideEndAt: null,
          overrideTitle: null,
          overrideNotes: null,
        },
      ],
    });
    const occ = expandBlock(block, d("2025-06-03T00:00:00"), d("2025-06-03T23:59:59"));
    expect(occ[0].notes).toBe("Original notes");
  });
});

// ── expandAllBlocks ──────────────────────────────────────────────────

describe("expandAllBlocks", () => {
  it("merges and sorts occurrences from multiple blocks", () => {
    const block1 = makeBlock({
      id: "a",
      title: "Morning",
      startAt: d("2025-06-02T08:00:00"),
      endAt: d("2025-06-02T09:00:00"),
    });
    const block2 = makeBlock({
      id: "b",
      title: "Afternoon",
      startAt: d("2025-06-02T14:00:00"),
      endAt: d("2025-06-02T15:00:00"),
    });
    const occ = expandAllBlocks(
      [block2, block1], // intentionally out of order
      d("2025-06-02T00:00:00"),
      d("2025-06-02T23:59:59"),
    );
    expect(occ).toHaveLength(2);
    expect(occ[0].title).toBe("Morning"); // sorted by startAt
    expect(occ[1].title).toBe("Afternoon");
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe("expandBlock — edge cases", () => {
  it("does not expand blocks with recurrence freq NONE", () => {
    const block = makeBlock({
      recurrence: { freq: "NONE", interval: 1, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    // freq=NONE is treated as single event
    expect(occ).toHaveLength(1);
    expect(occ[0].isRecurring).toBe(false);
  });

  it("handles range starting after block start (mid-week query)", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    // Query starts on Wed Jun 4, block was created on Mon Jun 2
    const occ = expandBlock(block, d("2025-06-04T00:00:00"), d("2025-06-06T23:59:59"));
    expect(occ).toHaveLength(3); // Jun 4, 5, 6
    expect(occ[0].occurrenceDate).toBe("2025-06-04");
  });

  it("returns empty for range entirely before block start", () => {
    const block = makeBlock({
      startAt: d("2025-06-10T09:00:00"),
      endAt: d("2025-06-10T10:00:00"),
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-08T23:59:59"));
    expect(occ).toHaveLength(0);
  });

  it("handles interval=1 correctly (no skipping)", () => {
    const block = makeBlock({
      recurrence: { freq: "DAILY", interval: 1, weekDays: null, until: null },
    });
    const occ = expandBlock(block, d("2025-06-02T00:00:00"), d("2025-06-02T23:59:59"));
    expect(occ).toHaveLength(1);
  });
});
