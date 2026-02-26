import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const VALID_CATEGORIES = [
  "sono", "medicacao", "refeicao", "trabalho", "social", "exercicio", "lazer", "outro",
] as const;
const VALID_KINDS = ["ANCHOR", "FLEX", "RISK"] as const;

const templateBlockSchema = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(VALID_CATEGORIES),
  kind: z.enum(VALID_KINDS).default("FLEX"),
  startTimeMin: z.number().int().min(0).max(1439),
  durationMin: z.number().int().min(5).max(1440),
  energyCost: z.number().int().min(0).max(10).default(3),
  stimulation: z.number().int().min(0).max(2).default(1),
  weekDay: z.number().int().min(0).max(6),
  notes: z.string().max(280).optional(),
});

const templateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(280).optional(),
  blocks: z.array(templateBlockSchema).optional(),
  fromWeekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const templates = await prisma.plannerTemplate.findMany({
    where: { userId: session.userId },
    include: { blocks: true },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = templateCreateSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const { name, description, blocks, fromWeekStart } = parsed.data;

    // Create from existing week
    if (fromWeekStart) {
      const monday = new Date(fromWeekStart + "T00:00:00");
      const weekEnd = new Date(monday);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const existingBlocks = await prisma.plannerBlock.findMany({
        where: {
          userId: session.userId,
          startAt: { gte: monday, lt: weekEnd },
        },
        include: { recurrence: true },
      });

      // Also expand recurring blocks into this week
      const allRecurring = await prisma.plannerBlock.findMany({
        where: {
          userId: session.userId,
          recurrence: { isNot: null },
          startAt: { lt: weekEnd },
        },
        include: { recurrence: true, exceptions: true },
      });

      // Build template blocks from concrete + expanded recurring
      const templateBlocks: {
        title: string; category: string; kind: string;
        startTimeMin: number; durationMin: number;
        energyCost: number; stimulation: number;
        weekDay: number; notes?: string;
      }[] = [];
      const seen = new Set<string>();

      // Process concrete blocks in the week
      for (const block of existingBlocks) {
        const startAt = new Date(block.startAt);
        const endAt = new Date(block.endAt);
        const key = `${block.title}-${startAt.getTime()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        templateBlocks.push({
          title: block.title,
          category: block.category,
          kind: block.kind,
          weekDay: startAt.getDay(),
          startTimeMin: startAt.getHours() * 60 + startAt.getMinutes(),
          durationMin: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
          energyCost: block.energyCost,
          stimulation: block.stimulation,
          notes: block.notes || undefined,
        });
      }

      // Expand recurring blocks into this week
      for (const block of allRecurring) {
        if (!block.recurrence) continue;
        const rec = block.recurrence;
        const blockStart = new Date(block.startAt);
        const durationMs = new Date(block.endAt).getTime() - blockStart.getTime();
        const weekDaysSet = rec.weekDays ? new Set(rec.weekDays.split(",").map(Number)) : null;

        for (let d = 0; d < 7; d++) {
          const date = new Date(monday);
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
            const ex = block.exceptions.find((e) => e.occurrenceDate.toISOString().split("T")[0] === ymd);
            if (ex?.isCancelled) continue;

            templateBlocks.push({
              title: ex?.overrideTitle || block.title,
              category: block.category,
              kind: block.kind,
              weekDay: date.getDay(),
              startTimeMin: occStart.getHours() * 60 + occStart.getMinutes(),
              durationMin: Math.round(durationMs / 60000),
              energyCost: block.energyCost,
              stimulation: block.stimulation,
              notes: block.notes || undefined,
            });
          }
        }
      }

      const template = await prisma.plannerTemplate.create({
        data: {
          userId: session.userId,
          name,
          description: description || null,
          blocks: {
            create: templateBlocks.map((tb) => ({
              title: tb.title,
              category: tb.category,
              kind: tb.kind,
              startTimeMin: tb.startTimeMin,
              durationMin: tb.durationMin,
              energyCost: tb.energyCost,
              stimulation: tb.stimulation,
              weekDay: tb.weekDay,
              notes: tb.notes || null,
            })),
          },
        },
        include: { blocks: true },
      });

      return NextResponse.json(template, { status: 201 });
    }

    // Create from provided blocks
    const template = await prisma.plannerTemplate.create({
      data: {
        userId: session.userId,
        name,
        description: description || null,
        ...(blocks && blocks.length > 0
          ? {
              blocks: {
                create: blocks.map((b) => ({
                  title: b.title,
                  category: b.category,
                  kind: b.kind,
                  startTimeMin: b.startTimeMin,
                  durationMin: b.durationMin,
                  energyCost: b.energyCost,
                  stimulation: b.stimulation,
                  weekDay: b.weekDay,
                  notes: b.notes || null,
                })),
              },
            }
          : {}),
      },
      include: { blocks: true },
    });

    return NextResponse.json(template, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar template." },
      { status: 500 },
    );
  }
}
