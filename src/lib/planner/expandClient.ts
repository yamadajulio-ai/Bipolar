import type { PlannerBlockData, ExpandedOccurrence } from "./types";
import { expandAllBlocks } from "./expandRecurrence";

/** Block shape returned by the API (all dates are ISO strings). */
export interface SerializedBlock {
  id: string;
  title: string;
  category: string;
  kind: string;
  isRoutine: boolean;
  startAt: string;
  endAt: string;
  notes: string | null;
  energyCost: number;
  stimulation: number;
  sourceType?: string; // "app" | "google"
  recurrence: {
    freq: string;
    interval: number;
    weekDays: string | null;
    until: string | null;
  } | null;
  exceptions: {
    occurrenceDate: string;
    isCancelled: boolean;
    overrideStartAt: string | null;
    overrideEndAt: string | null;
    overrideTitle: string | null;
    overrideNotes: string | null;
  }[];
}

/** Hydrate a serialized block (ISO strings → Date objects). */
function hydrate(block: SerializedBlock): PlannerBlockData {
  return {
    id: block.id,
    title: block.title,
    category: block.category,
    kind: block.kind,
    isRoutine: block.isRoutine ?? false,
    startAt: new Date(block.startAt),
    endAt: new Date(block.endAt),
    notes: block.notes,
    energyCost: block.energyCost,
    stimulation: block.stimulation,
    sourceType: block.sourceType,
    recurrence: block.recurrence
      ? {
          freq: block.recurrence.freq,
          interval: block.recurrence.interval ?? 1,
          weekDays: block.recurrence.weekDays,
          until: block.recurrence.until ? new Date(block.recurrence.until) : null,
        }
      : null,
    exceptions: (block.exceptions || []).map((ex) => ({
      occurrenceDate: new Date(ex.occurrenceDate),
      isCancelled: ex.isCancelled,
      overrideStartAt: ex.overrideStartAt ? new Date(ex.overrideStartAt) : null,
      overrideEndAt: ex.overrideEndAt ? new Date(ex.overrideEndAt) : null,
      overrideTitle: ex.overrideTitle,
      overrideNotes: ex.overrideNotes ?? null,
    })),
  };
}

/**
 * Hydrate serialized API blocks and expand recurrences into a date range.
 * Use this in client components instead of duplicating expansion logic.
 */
export function expandSerializedBlocks(
  blocks: SerializedBlock[],
  rangeStart: Date,
  rangeEnd: Date,
): ExpandedOccurrence[] {
  const hydrated = blocks.map(hydrate);
  return expandAllBlocks(hydrated, rangeStart, rangeEnd);
}
