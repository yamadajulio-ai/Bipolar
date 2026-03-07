import type { PlannerBlockData, ExpandedOccurrence } from "./types";
import { localDateStr } from "@/lib/dateUtils";

function dateToYMD(d: Date): string {
  return localDateStr(d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getTimeParts(d: Date): { hours: number; minutes: number } {
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

function setTimeOnDate(date: Date, hours: number, minutes: number): Date {
  const r = new Date(date);
  r.setHours(hours, minutes, 0, 0);
  return r;
}

function stripTime(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((stripTime(b).getTime() - stripTime(a).getTime()) / 86400000);
}

/**
 * Range-based recurrence expansion.
 * Iterates each day in [rangeStart, rangeEnd] and checks whether the block
 * recurs on that day, correctly handling interval for both DAILY and WEEKLY.
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

  // Recurring: range-based iteration
  const effectiveUntil = rec.until && rec.until < rangeEnd ? rec.until : rangeEnd;
  const weekDaysSet = rec.weekDays
    ? new Set(rec.weekDays.split(",").map(Number))
    : null;

  const blockStartDay = stripTime(block.startAt);
  const interval = Math.max(1, rec.interval);

  // Start iterating from the later of rangeStart or block creation day
  let cursor = rangeStart < blockStartDay ? new Date(blockStartDay) : new Date(rangeStart);
  cursor.setHours(12, 0, 0, 0); // Noon to avoid DST issues

  while (cursor <= effectiveUntil) {
    const daysSince = daysBetween(blockStartDay, cursor);

    let matches = false;

    if (rec.freq === "DAILY") {
      matches = daysSince % interval === 0;
    } else if (rec.freq === "WEEKLY") {
      const weeksSince = Math.floor(daysSince / 7);
      if (weekDaysSet && weekDaysSet.size > 0) {
        // WEEKLY with specific days: check weekday is in set AND week interval matches
        matches = weekDaysSet.has(cursor.getDay()) && weeksSince % interval === 0;
      } else {
        // WEEKLY plain: same weekday as original AND week interval matches
        matches = cursor.getDay() === blockStartDay.getDay() && weeksSince % interval === 0;
      }
    }

    if (matches) {
      const occStart = setTimeOnDate(cursor, startTime.hours, startTime.minutes);
      const occEnd = new Date(occStart.getTime() + durationMs);

      const ymd = dateToYMD(cursor);
      const ex = exceptionMap.get(ymd);

      if (!ex?.isCancelled) {
        occurrences.push(
          applyException(block, occStart, occEnd, ymd, true, ex),
        );
      }
    }

    cursor = addDays(cursor, 1);
  }

  return occurrences;
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
    notes: ex?.overrideNotes != null ? ex.overrideNotes : block.notes,
    energyCost: block.energyCost,
    stimulation: block.stimulation,
    sourceType: block.sourceType,
    googleColor: block.googleColor,
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
