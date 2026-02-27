import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { blockToGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from "@/lib/google/calendar";

const VALID_KINDS = ["ANCHOR", "FLEX", "RISK"] as const;
const VALID_CATEGORIES = [
  "sono", "medicacao", "refeicao", "trabalho", "social", "exercicio", "lazer", "outro",
] as const;

const blockUpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  kind: z.enum(VALID_KINDS).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  notes: z.string().max(280).optional(),
  energyCost: z.number().int().min(0).max(10).optional(),
  stimulation: z.number().int().min(0).max(2).optional(),
  isRoutine: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const block = await prisma.plannerBlock.findUnique({
    where: { id },
    include: { recurrence: true, exceptions: true },
  });

  if (!block || block.userId !== session.userId) {
    return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
  }

  return NextResponse.json(block);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.plannerBlock.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = blockUpdateSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.category !== undefined) updateData.category = parsed.data.category;
    if (parsed.data.kind !== undefined) updateData.kind = parsed.data.kind;
    if (parsed.data.startAt !== undefined) updateData.startAt = new Date(parsed.data.startAt);
    if (parsed.data.endAt !== undefined) updateData.endAt = new Date(parsed.data.endAt);
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.energyCost !== undefined) updateData.energyCost = parsed.data.energyCost;
    if (parsed.data.stimulation !== undefined) updateData.stimulation = parsed.data.stimulation;
    if (parsed.data.isRoutine !== undefined) updateData.isRoutine = parsed.data.isRoutine;

    // Validate endAt > startAt (using updated or existing values)
    const finalStart = updateData.startAt ? (updateData.startAt as Date) : existing.startAt;
    const finalEnd = updateData.endAt ? (updateData.endAt as Date) : existing.endAt;
    if (finalEnd <= finalStart) {
      return NextResponse.json(
        { errors: { endAt: ["endAt deve ser posterior a startAt"] } },
        { status: 400 },
      );
    }

    const block = await prisma.plannerBlock.update({
      where: { id },
      data: updateData,
      include: { recurrence: true, exceptions: true },
    });

    // Sync update to Google Calendar if linked (non-blocking)
    if (block.googleEventId) {
      try {
        const googleAccount = await prisma.googleAccount.findUnique({
          where: { userId: session.userId },
        });
        if (googleAccount) {
          const auth = await getAuthenticatedClient(session.userId);
          const event = blockToGoogleEvent(block);
          await updateGoogleEvent(auth, googleAccount.calendarId, block.googleEventId, event);
        }
      } catch {
        // Google sync failure doesn't prevent block update
      }
    }

    return NextResponse.json(block);
  } catch {
    return NextResponse.json(
      { error: "Erro ao atualizar bloco." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.plannerBlock.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
  }

  // Delete from Google Calendar if linked (non-blocking)
  if (existing.googleEventId) {
    try {
      const googleAccount = await prisma.googleAccount.findUnique({
        where: { userId: session.userId },
      });
      if (googleAccount) {
        const auth = await getAuthenticatedClient(session.userId);
        await deleteGoogleEvent(auth, googleAccount.calendarId, existing.googleEventId);
      }
    } catch {
      // Google sync failure doesn't prevent block deletion
    }
  }

  await prisma.plannerBlock.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
