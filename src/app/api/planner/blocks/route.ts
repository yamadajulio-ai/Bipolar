import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const VALID_KINDS = ["ANCHOR", "FLEX", "RISK"] as const;
const VALID_CATEGORIES = [
  "sono", "medicacao", "refeicao", "trabalho", "social", "exercicio", "lazer", "outro",
] as const;
const VALID_FREQS = ["NONE", "DAILY", "WEEKLY"] as const;

const recurrenceSchema = z.object({
  freq: z.enum(VALID_FREQS),
  interval: z.number().int().min(1).max(4).default(1),
  weekDays: z.string().regex(/^[0-6](,[0-6])*$/).optional(),
  until: z.string().datetime().optional(),
});

const blockCreateSchema = z.object({
  title: z.string().min(1).max(100),
  category: z.enum(VALID_CATEGORIES),
  kind: z.enum(VALID_KINDS).default("FLEX"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  notes: z.string().max(280).optional(),
  energyCost: z.number().int().min(0).max(10).default(3),
  stimulation: z.number().int().min(0).max(2).default(1),
  isRoutine: z.boolean().default(false),
  recurrence: recurrenceSchema.optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  const routinesOnly = searchParams.get("routinesOnly") === "true";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let where: any = { userId: session.userId, ...(routinesOnly ? { isRoutine: true } : {}) };
  if (timeMin || timeMax) {
    // Fetch non-recurring blocks in range AND recurring blocks that may expand into range
    where = {
      userId: session.userId,
      ...(routinesOnly ? { isRoutine: true } : {}),
      OR: [
        // Non-recurring blocks that overlap with range (startAt <= timeMax AND endAt >= timeMin)
        {
          ...(timeMin ? { endAt: { gte: new Date(timeMin) } } : {}),
          ...(timeMax ? { startAt: { lte: new Date(timeMax) } } : {}),
        },
        // Recurring blocks created before range that might still generate occurrences
        ...(timeMax
          ? [
              {
                recurrence: { isNot: null },
                startAt: { lte: new Date(timeMax) },
              },
            ]
          : []),
      ],
    };
  }

  const blocks = await prisma.plannerBlock.findMany({
    where,
    include: { recurrence: true, exceptions: true },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = blockCreateSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const { recurrence, ...blockData } = parsed.data;

    const block = await prisma.plannerBlock.create({
      data: {
        userId: session.userId,
        title: blockData.title,
        category: blockData.category,
        kind: blockData.kind,
        startAt: new Date(blockData.startAt),
        endAt: new Date(blockData.endAt),
        notes: blockData.notes || null,
        energyCost: blockData.energyCost,
        stimulation: blockData.stimulation,
        isRoutine: blockData.isRoutine,
        ...(recurrence && recurrence.freq !== "NONE"
          ? {
              recurrence: {
                create: {
                  freq: recurrence.freq,
                  interval: recurrence.interval,
                  weekDays: recurrence.weekDays || null,
                  until: recurrence.until ? new Date(recurrence.until) : null,
                },
              },
            }
          : {}),
      },
      include: { recurrence: true, exceptions: true },
    });

    return NextResponse.json(block, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao criar bloco." },
      { status: 500 },
    );
  }
}
