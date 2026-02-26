import type { PlannerBlockData } from "./types";
import { expandAllBlocks } from "./expandRecurrence";
import type { ExpandedOccurrence } from "./types";

/**
 * Shape of a PlannerBlock as returned by Prisma (with includes).
 * Dates are already Date objects on the server.
 */
interface PrismaBlock {
  id: string;
  title: string;
  category: string;
  kind: string;
  isRoutine: boolean;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  energyCost: number;
  stimulation: number;
  recurrence: {
    freq: string;
    interval: number;
    weekDays: string | null;
    until: Date | null;
  } | null;
  exceptions: {
    occurrenceDate: Date;
    isCancelled: boolean;
    overrideStartAt: Date | null;
    overrideEndAt: Date | null;
    overrideTitle: string | null;
    overrideNotes: string | null;
  }[];
}

/** Convert a Prisma block to the engine's PlannerBlockData. */
function toPlannerBlock(block: PrismaBlock): PlannerBlockData {
  return {
    id: block.id,
    title: block.title,
    category: block.category,
    kind: block.kind,
    isRoutine: block.isRoutine,
    startAt: block.startAt,
    endAt: block.endAt,
    notes: block.notes,
    energyCost: block.energyCost,
    stimulation: block.stimulation,
    recurrence: block.recurrence
      ? {
          freq: block.recurrence.freq,
          interval: block.recurrence.interval ?? 1,
          weekDays: block.recurrence.weekDays,
          until: block.recurrence.until,
        }
      : null,
    exceptions: (block.exceptions || []).map((ex) => ({
      occurrenceDate: ex.occurrenceDate,
      isCancelled: ex.isCancelled,
      overrideStartAt: ex.overrideStartAt,
      overrideEndAt: ex.overrideEndAt,
      overrideTitle: ex.overrideTitle,
      overrideNotes: ex.overrideNotes ?? null,
    })),
  };
}

/**
 * Expand Prisma blocks into occurrences within a date range.
 * Use this on the server instead of duplicating expansion logic.
 */
export function expandPrismaBlocks(
  blocks: PrismaBlock[],
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedOccurrence[] {
  const converted = blocks.map(toPlannerBlock);
  return expandAllBlocks(converted, rangeStart, rangeEnd);
}
