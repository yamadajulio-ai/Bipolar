import { prisma } from "@/lib/db";
import { expandPrismaBlocks } from "./expandServer";

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
  const fromSundayEnd = new Date(fromWeekStart + "T00:00:00");
  fromSundayEnd.setDate(fromSundayEnd.getDate() + 6);
  fromSundayEnd.setHours(23, 59, 59, 999);

  const toMonday = new Date(toWeekStart + "T00:00:00");
  const toEnd = new Date(toMonday);
  toEnd.setDate(toEnd.getDate() + 7);

  // Fetch all blocks that could produce occurrences in the source week
  const allBlocks = await prisma.plannerBlock.findMany({
    where: {
      userId,
      OR: [
        { startAt: { lte: fromSundayEnd }, endAt: { gte: fromMonday } },
        { recurrence: { isNot: null }, startAt: { lte: fromSundayEnd } },
      ],
    },
    include: { recurrence: true, exceptions: true },
  });

  // Use shared range-based engine (respects interval, exceptions, etc.)
  const occurrences = expandPrismaBlocks(allBlocks, fromMonday, fromSundayEnd);

  // Filter by mode
  let filtered = occurrences;
  if (mode === "flexOnly") {
    filtered = occurrences.filter((o) => o.kind === "FLEX");
  } else if (mode === "exceptAnchors") {
    filtered = occurrences.filter((o) => o.kind !== "ANCHOR");
  }

  // Skip routines (they repeat naturally)
  filtered = filtered.filter((o) => !o.isRoutine);

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

  for (const occ of filtered) {
    const newStart = new Date(occ.startAt.getTime() + dayOffsetMs + offsetMs);
    const newEnd = new Date(occ.endAt.getTime() + dayOffsetMs + offsetMs);

    // Duplicate detection: same title + overlapping time
    const isDuplicate = existingTarget.some(
      (eb) =>
        eb.title === occ.title &&
        new Date(eb.startAt) < newEnd &&
        new Date(eb.endAt) > newStart,
    );
    if (isDuplicate) continue;

    await prisma.plannerBlock.create({
      data: {
        userId,
        title: occ.title,
        category: occ.category,
        kind: occ.kind,
        startAt: newStart,
        endAt: newEnd,
        energyCost: occ.energyCost,
        stimulation: occ.stimulation,
        notes: occ.notes,
      },
    });
    created++;
  }

  return { created };
}
