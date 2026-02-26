import { prisma } from "@/lib/db";

interface ExpandedBlock {
  title: string;
  category: string;
  kind: string;
  startAt: Date;
  endAt: Date;
  energyCost: number;
  stimulation: number;
  notes: string | null;
  isRoutine: boolean;
}

/**
 * Clone blocks from one week to another.
 * fromWeekStart / toWeekStart = ISO date strings (YYYY-MM-DD) of Monday
 * mode: "all" | "flexOnly" | "exceptAnchors"
 * offsetMin: optional minutes to shift all blocks
 */
export async function cloneWeek(
  userId: string,
  fromWeekStart: string,
  toWeekStart: string,
  mode: "all" | "flexOnly" | "exceptAnchors",
  offsetMin: number = 0,
) {
  const fromMonday = new Date(fromWeekStart + "T00:00:00");
  const fromEnd = new Date(fromMonday);
  fromEnd.setDate(fromEnd.getDate() + 7);

  const toMonday = new Date(toWeekStart + "T00:00:00");
  const toEnd = new Date(toMonday);
  toEnd.setDate(toEnd.getDate() + 7);

  // Fetch source blocks (concrete in range)
  const sourceBlocks = await prisma.plannerBlock.findMany({
    where: {
      userId,
      startAt: { gte: fromMonday, lt: fromEnd },
    },
    include: { recurrence: true },
  });

  // Also fetch recurring blocks that may expand into the source week
  const recurringBlocks = await prisma.plannerBlock.findMany({
    where: {
      userId,
      recurrence: { isNot: null },
      startAt: { lt: fromEnd },
    },
    include: { recurrence: true, exceptions: true },
  });

  // Build expanded list
  const expanded: ExpandedBlock[] = [];
  const seen = new Set<string>();

  for (const block of sourceBlocks) {
    const key = `${block.title}-${new Date(block.startAt).getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    expanded.push({
      title: block.title,
      category: block.category,
      kind: block.kind,
      startAt: new Date(block.startAt),
      endAt: new Date(block.endAt),
      energyCost: block.energyCost,
      stimulation: block.stimulation,
      notes: block.notes,
      isRoutine: block.isRoutine,
    });
  }

  // Expand recurring into the source week
  for (const block of recurringBlocks) {
    if (!block.recurrence) continue;
    const rec = block.recurrence;
    const blockStart = new Date(block.startAt);
    const durationMs = new Date(block.endAt).getTime() - blockStart.getTime();
    const weekDaysSet = rec.weekDays ? new Set(rec.weekDays.split(",").map(Number)) : null;

    for (let d = 0; d < 7; d++) {
      const date = new Date(fromMonday);
      date.setDate(date.getDate() + d);
      if (rec.until && new Date(rec.until) < date) continue;
      if (blockStart > date) continue;

      let matches = false;
      if (rec.freq === "DAILY") matches = true;
      if (rec.freq === "WEEKLY") {
        matches = weekDaysSet
          ? weekDaysSet.has(date.getDay())
          : date.getDay() === blockStart.getDay();
      }

      if (matches) {
        const occStart = new Date(date);
        occStart.setHours(blockStart.getHours(), blockStart.getMinutes(), 0, 0);
        const key = `${block.title}-${occStart.getTime()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Check exceptions
        const ymd = date.toISOString().split("T")[0];
        const ex = block.exceptions.find(
          (e) => e.occurrenceDate.toISOString().split("T")[0] === ymd,
        );
        if (ex?.isCancelled) continue;

        expanded.push({
          title: ex?.overrideTitle || block.title,
          category: block.category,
          kind: block.kind,
          startAt: ex?.overrideStartAt ? new Date(ex.overrideStartAt) : occStart,
          endAt: ex?.overrideEndAt ? new Date(ex.overrideEndAt) : new Date(occStart.getTime() + durationMs),
          energyCost: block.energyCost,
          stimulation: block.stimulation,
          notes: block.notes,
          isRoutine: block.isRoutine,
        });
      }
    }
  }

  // Filter by mode
  let filtered = expanded;
  if (mode === "flexOnly") {
    filtered = expanded.filter((b) => b.kind === "FLEX");
  } else if (mode === "exceptAnchors") {
    filtered = expanded.filter((b) => b.kind !== "ANCHOR");
  }

  // Skip routines (they repeat naturally)
  filtered = filtered.filter((b) => !b.isRoutine);

  // Fetch existing blocks in target week for duplicate detection
  const existingTarget = await prisma.plannerBlock.findMany({
    where: {
      userId,
      startAt: { gte: toMonday, lt: toEnd },
    },
    select: { title: true, startAt: true, endAt: true },
  });

  // Calculate day offset between source and target Monday
  const dayOffsetMs = toMonday.getTime() - fromMonday.getTime();
  const offsetMs = offsetMin * 60000;

  let created = 0;

  for (const block of filtered) {
    const newStart = new Date(block.startAt.getTime() + dayOffsetMs + offsetMs);
    const newEnd = new Date(block.endAt.getTime() + dayOffsetMs + offsetMs);

    // Duplicate detection: same title + overlapping time
    const isDuplicate = existingTarget.some(
      (eb) =>
        eb.title === block.title &&
        new Date(eb.startAt) < newEnd &&
        new Date(eb.endAt) > newStart,
    );
    if (isDuplicate) continue;

    await prisma.plannerBlock.create({
      data: {
        userId,
        title: block.title,
        category: block.category,
        kind: block.kind,
        startAt: newStart,
        endAt: newEnd,
        energyCost: block.energyCost,
        stimulation: block.stimulation,
        notes: block.notes,
      },
    });
    created++;
  }

  return { created };
}
