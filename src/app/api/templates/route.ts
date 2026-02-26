import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { expandPrismaBlocks } from "@/lib/planner/expandServer";

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
      const sundayEnd = new Date(fromWeekStart + "T00:00:00");
      sundayEnd.setDate(sundayEnd.getDate() + 6);
      sundayEnd.setHours(23, 59, 59, 999);

      // Fetch all blocks that could produce occurrences in this week
      const allBlocks = await prisma.plannerBlock.findMany({
        where: {
          userId: session.userId,
          OR: [
            { startAt: { lte: sundayEnd }, endAt: { gte: monday } },
            { recurrence: { isNot: null }, startAt: { lte: sundayEnd } },
          ],
        },
        include: { recurrence: true, exceptions: true },
      });

      // Use the shared range-based engine (respects interval, exceptions, etc.)
      const occurrences = expandPrismaBlocks(allBlocks, monday, sundayEnd);

      const templateBlocks = occurrences.map((occ) => ({
        title: occ.title,
        category: occ.category,
        kind: occ.kind,
        weekDay: occ.startAt.getDay(),
        startTimeMin: occ.startAt.getHours() * 60 + occ.startAt.getMinutes(),
        durationMin: Math.max(5, Math.round((occ.endAt.getTime() - occ.startAt.getTime()) / 60000)),
        energyCost: occ.energyCost,
        stimulation: occ.stimulation,
        notes: occ.notes || undefined,
      }));

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
