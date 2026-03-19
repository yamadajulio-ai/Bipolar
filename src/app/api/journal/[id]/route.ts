import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { detectCrisisContent } from "@/lib/journal/crisis-detection";

// ── PATCH — Edit journal entry (own only, with editedAt tracking) ──

const updateSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  aiUseAllowed: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const allowed = await checkRateLimit(`journal_edit:${session.userId}`, 30, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas edições. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.journalEntry.findUnique({
      where: { id },
      select: { userId: true, type: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
    }

    // Enforce type-specific limits
    if (
      parsed.data.content &&
      existing.type === "QUICK_INSIGHT" &&
      parsed.data.content.length > 280
    ) {
      return NextResponse.json(
        { error: "Insight rápido deve ter no máximo 280 caracteres." },
        { status: 400 },
      );
    }

    const updated = await prisma.journalEntry.update({
      where: { id },
      data: {
        ...parsed.data,
        editedAt: new Date(),
      },
      select: {
        id: true,
        type: true,
        content: true,
        zoneAtCapture: true,
        editedAt: true,
      },
    });

    // Crisis detection on edited content
    const crisis = parsed.data.content
      ? detectCrisisContent(parsed.data.content)
      : { detected: false };

    return NextResponse.json({
      ...updated,
      crisisDetected: crisis.detected,
    });
  } catch (err) {
    console.error("Journal update error:", (err as Error).message);
    return NextResponse.json({ error: "Erro ao atualizar entrada" }, { status: 500 });
  }
}

// ── DELETE — Hard delete journal entry (own only) ───────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const allowed = await checkRateLimit(`journal_del:${session.userId}`, 20, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas exclusões. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  try {
    // Verify ownership before delete
    const existing = await prisma.journalEntry.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });
    }

    // Hard delete — no soft delete for sensitive content
    await prisma.journalEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Journal delete error:", (err as Error).message);
    return NextResponse.json({ error: "Erro ao excluir entrada" }, { status: 500 });
  }
}
