import { prisma } from "@/lib/db";

interface TemplateBlockData {
  title: string;
  category: string;
  kind: string;
  startTimeMin: number;
  durationMin: number;
  energyCost: number;
  stimulation: number;
  weekDay: number;
  notes: string | null;
}

/**
 * Apply template blocks to a target week.
 * weekStart = ISO date string of Monday (YYYY-MM-DD)
 * mode: "overwrite" | "merge" | "missingOnly"
 */
export async function applyTemplate(
  userId: string,
  templateId: string,
  weekStart: string,
  mode: "overwrite" | "merge" | "missingOnly",
) {
  const template = await prisma.plannerTemplate.findFirst({
    where: { id: templateId, userId },
    include: { blocks: true },
  });

  if (!template) throw new Error("Template não encontrado");

  const monday = new Date(weekStart + "T00:00:00");

  // For overwrite mode, delete non-routine blocks in the target week
  if (mode === "overwrite") {
    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.plannerBlock.deleteMany({
      where: {
        userId,
        isRoutine: false,
        startAt: { gte: monday, lt: weekEnd },
        recurrence: null,
      },
    });
  }

  // For merge/missingOnly, load existing blocks in the week
  let existingBlocks: { startAt: Date; endAt: Date; title: string }[] = [];
  if (mode === "merge" || mode === "missingOnly") {
    const weekEnd = new Date(monday);
    weekEnd.setDate(weekEnd.getDate() + 7);

    existingBlocks = await prisma.plannerBlock.findMany({
      where: {
        userId,
        startAt: { gte: monday, lt: weekEnd },
      },
      select: { startAt: true, endAt: true, title: true },
    });
  }

  const blocksToCreate: TemplateBlockData[] = template.blocks;
  const created: string[] = [];

  for (const tb of blocksToCreate) {
    // Calculate actual date from weekDay offset
    // weekDay: 0=Dom, 1=Seg..6=Sab
    // monday is day 1, so offset = (weekDay - 1 + 7) % 7
    const dayOffset = (tb.weekDay - 1 + 7) % 7;
    const blockDate = new Date(monday);
    blockDate.setDate(blockDate.getDate() + dayOffset);

    const hours = Math.floor(tb.startTimeMin / 60);
    const minutes = tb.startTimeMin % 60;
    const startAt = new Date(blockDate);
    startAt.setHours(hours, minutes, 0, 0);

    const endAt = new Date(startAt.getTime() + tb.durationMin * 60000);

    // Check for overlaps/duplicates
    if (mode === "merge") {
      const hasOverlap = existingBlocks.some(
        (eb) => eb.startAt < endAt && eb.endAt > startAt,
      );
      if (hasOverlap) continue;
    }

    if (mode === "missingOnly") {
      const hasSameSlot = existingBlocks.some(
        (eb) =>
          eb.startAt.getTime() === startAt.getTime() &&
          eb.title === tb.title,
      );
      if (hasSameSlot) continue;
    }

    const block = await prisma.plannerBlock.create({
      data: {
        userId,
        title: tb.title,
        category: tb.category,
        kind: tb.kind,
        startAt,
        endAt,
        energyCost: tb.energyCost,
        stimulation: tb.stimulation,
        notes: tb.notes,
      },
    });
    created.push(block.id);
  }

  return { created: created.length, templateName: template.name };
}
