import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr, startOfDay, endOfDay } from "@/lib/dateUtils";

const exceptionUpsertSchema = z.object({
  occurrenceDate: z.string().datetime(),
  isCancelled: z.boolean().default(false),
  overrideStartAt: z.string().datetime().optional(),
  overrideEndAt: z.string().datetime().optional(),
  overrideTitle: z.string().max(100).optional(),
  overrideNotes: z.string().max(280).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const block = await prisma.plannerBlock.findUnique({
    where: { id },
    include: { recurrence: true },
  });
  if (!block || block.userId !== session.userId) {
    return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = exceptionUpsertSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    // Normalize occurrenceDate to noon local to prevent duplicate keys
    const occYmd = localDateStr(new Date(parsed.data.occurrenceDate));
    const occDate = new Date(occYmd + "T12:00:00");

    // For non-recurring blocks, exception must target the block's own day
    const isRecurring = block.recurrence && block.recurrence.freq !== "NONE";
    if (!isRecurring) {
      const blockYmd = localDateStr(block.startAt);
      if (occYmd !== blockYmd) {
        return NextResponse.json(
          { errors: { occurrenceDate: ["Bloco não-recorrente só aceita exceção no próprio dia"] } },
          { status: 400 },
        );
      }
    }

    // Compute the occurrence's base interval (same logic as the expand engine):
    // baseStart = occurrenceDate at block's start time, baseEnd = baseStart + duration
    const durationMs = block.endAt.getTime() - block.startAt.getTime();
    const baseStart = new Date(occYmd + "T00:00:00");
    baseStart.setHours(block.startAt.getHours(), block.startAt.getMinutes(), 0, 0);
    const baseEnd = new Date(baseStart.getTime() + durationMs);

    // Validate effective interval using occurrence base
    if (parsed.data.overrideStartAt || parsed.data.overrideEndAt) {
      const effectiveStart = parsed.data.overrideStartAt
        ? new Date(parsed.data.overrideStartAt)
        : baseStart;
      const effectiveEnd = parsed.data.overrideEndAt
        ? new Date(parsed.data.overrideEndAt)
        : baseEnd;
      if (effectiveEnd <= effectiveStart) {
        return NextResponse.json(
          { errors: { overrideEndAt: ["overrideEndAt deve ser posterior a overrideStartAt (efetivo)"] } },
          { status: 400 },
        );
      }

      // Validate overrideStartAt stays within the occurrence day
      // (prevent day-jumping — allows overnight into next day only)
      if (parsed.data.overrideStartAt) {
        const overrideStartYmd = localDateStr(effectiveStart);
        if (overrideStartYmd !== occYmd) {
          return NextResponse.json(
            { errors: { overrideStartAt: ["overrideStartAt deve ser no mesmo dia da ocorrência"] } },
            { status: 400 },
          );
        }
      }
      // overrideEndAt can be occYmd or occYmd+1 (overnight), but not further
      if (parsed.data.overrideEndAt) {
        const nextDayEnd = new Date(occYmd + "T00:00:00");
        nextDayEnd.setDate(nextDayEnd.getDate() + 2); // end of occYmd+1
        if (effectiveEnd > nextDayEnd) {
          return NextResponse.json(
            { errors: { overrideEndAt: ["overrideEndAt não pode passar do dia seguinte"] } },
            { status: 400 },
          );
        }
      }
    }

    // Find existing exception for this day (handles legacy data with non-noon times)
    const dayStart = startOfDay(occYmd);
    const dayEnd = endOfDay(occYmd);
    const existing = await prisma.plannerException.findFirst({
      where: {
        blockId: id,
        occurrenceDate: { gte: dayStart, lte: dayEnd },
      },
    });

    const data = {
      isCancelled: parsed.data.isCancelled,
      overrideStartAt: parsed.data.overrideStartAt ? new Date(parsed.data.overrideStartAt) : null,
      overrideEndAt: parsed.data.overrideEndAt ? new Date(parsed.data.overrideEndAt) : null,
      overrideTitle: parsed.data.overrideTitle ?? null,
      overrideNotes: parsed.data.overrideNotes ?? null,
    };

    let exception;
    if (existing) {
      // Update existing + normalize occurrenceDate to noon
      exception = await prisma.plannerException.update({
        where: { id: existing.id },
        data: { ...data, occurrenceDate: occDate },
      });
    } else {
      exception = await prisma.plannerException.create({
        data: { blockId: id, occurrenceDate: occDate, ...data },
      });
    }

    return NextResponse.json(exception, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar exceção." },
      { status: 500 },
    );
  }
}
