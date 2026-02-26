import type { PlannerBlockData, ExpandedOccurrence } from "./types";

function dateToYMD(d: Date): string {
  return d.toISOString().split("T")[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getDayOfWeek(d: Date): number {
  return d.getDay(); // 0=Sun..6=Sat
}

function getTimeParts(d: Date): { hours: number; minutes: number } {
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const r = new Date(date);
  r.setHours(hours, minutes, 0, 0);
  return r;
}

/**
 * Expands a block's recurrence into individual occurrences within [rangeStart, rangeEnd].
 * Applies exceptions (cancellations and overrides).
 */
export function expandBlock(
  block: PlannerBlockData,
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedOccurrence[] {
  const occurrences: ExpandedOccurrence[] = [];
  const rec = block.recurrence;

  // Build exception map keyed by YYYY-MM-DD
  const exceptionMap = new Map<string, PlannerBlockData["exceptions"][number]>();
  for (const ex of block.exceptions) {
    exceptionMap.set(dateToYMD(ex.occurrenceDate), ex);
  }

  const startTime = getTimeParts(block.startAt);
  const durationMs = block.endAt.getTime() - block.startAt.getTime();

  if (!rec || rec.freq === "NONE") {
    // Single event — include if it overlaps with range
    if (block.startAt <= rangeEnd && block.endAt >= rangeStart) {
      const ymd = dateToYMD(block.startAt);
      const ex = exceptionMap.get(ymd);
      if (ex?.isCancelled) return occurrences;

      occurrences.push(applyException(block, block.startAt, block.endAt, ymd, false, ex));
    }
    return occurrences;
  }

  // Recurring: iterate from block start through range
  const effectiveUntil = rec.until && rec.until < rangeEnd ? rec.until : rangeEnd;
  const weekDaysSet = rec.weekDays
    ? new Set(rec.weekDays.split(",").map(Number))
    : null;

  let cursor = new Date(block.startAt);
  // Move cursor to rangeStart if block starts earlier
  while (cursor < rangeStart) {
    cursor = advanceCursor(cursor, rec.freq, rec.interval, weekDaysSet);
  }
  // But we also need the original start if it falls in range
  if (block.startAt >= rangeStart && block.startAt <= rangeEnd) {
    cursor = new Date(block.startAt);
  }

  // Reset cursor to the original block start date to correctly generate occurrences
  cursor = new Date(block.startAt);

  const maxIterations = 400; // safety limit
  let iterations = 0;

  while (cursor <= effectiveUntil && iterations < maxIterations) {
    iterations++;

    const occStart = setTimeOnDate(cursor, startTime.hours, startTime.minutes);
    const occEnd = new Date(occStart.getTime() + durationMs);

    // Check if in range
    if (occStart <= rangeEnd && occEnd >= rangeStart) {
      // Check weekday filter for WEEKLY
      if (rec.freq === "WEEKLY" && weekDaysSet && !weekDaysSet.has(getDayOfWeek(cursor))) {
        cursor = addDays(cursor, 1);
        continue;
      }

      const ymd = dateToYMD(cursor);
      const ex = exceptionMap.get(ymd);

      if (!ex?.isCancelled) {
        occurrences.push(
          applyException(block, occStart, occEnd, ymd, true, ex),
        );
      }
    }

    cursor = advanceCursor(cursor, rec.freq, rec.interval, weekDaysSet);
  }

  return occurrences;
}

function advanceCursor(
  cursor: Date,
  freq: string,
  interval: number,
  weekDaysSet: Set<number> | null,
): Date {
  if (freq === "DAILY") {
    return addDays(cursor, interval);
  }
  if (freq === "WEEKLY") {
    if (weekDaysSet && weekDaysSet.size > 0) {
      // Advance to next matching weekday
      let next = addDays(cursor, 1);
      let safety = 0;
      while (!weekDaysSet.has(getDayOfWeek(next)) && safety < 14) {
        next = addDays(next, 1);
        safety++;
      }
      return next;
    }
    return addDays(cursor, 7 * interval);
  }
  // NONE — shouldn't reach here
  return addDays(cursor, 1);
}

function applyException(
  block: PlannerBlockData,
  startAt: Date,
  endAt: Date,
  ymd: string,
  isRecurring: boolean,
  ex?: PlannerBlockData["exceptions"][number],
): ExpandedOccurrence {
  return {
    blockId: block.id,
    title: ex?.overrideTitle || block.title,
    category: block.category,
    kind: block.kind,
    isRoutine: block.isRoutine,
    startAt: ex?.overrideStartAt || startAt,
    endAt: ex?.overrideEndAt || endAt,
    notes: ex?.overrideNotes !== undefined ? ex.overrideNotes : block.notes,
    energyCost: block.energyCost,
    stimulation: block.stimulation,
    isRecurring,
    occurrenceDate: ymd,
  };
}

/**
 * Expand all blocks in a list within the given range.
 */
export function expandAllBlocks(
  blocks: PlannerBlockData[],
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedOccurrence[] {
  const all: ExpandedOccurrence[] = [];
  for (const block of blocks) {
    all.push(...expandBlock(block, rangeStart, rangeEnd));
  }
  return all.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
