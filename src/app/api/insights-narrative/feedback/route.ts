import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const feedbackSchema = z.object({
  narrativeId: z.string().uuid(),
  rating: z.enum(["useful", "not_useful"]),
  reasonCodes: z.array(z.string().max(50)).max(5).default([]),
  comment: z.string().max(500).optional(),
});

// POST — Submit feedback for a narrative
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`narrative_feedback:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
  }

  const { narrativeId, rating, reasonCodes, comment } = parsed.data;

  try {
    // Verify narrative belongs to user
    const narrative = await prisma.narrative.findFirst({
      where: { id: narrativeId, userId: session.userId },
      select: { id: true },
    });

    if (!narrative) {
      return NextResponse.json({ error: "Narrativa não encontrada" }, { status: 404 });
    }

    // Prevent duplicate feedback (one per narrative per user)
    const existing = await prisma.narrativeFeedback.findFirst({
      where: { narrativeId },
      select: { id: true },
    });

    if (existing) {
      // Update existing feedback
      await prisma.narrativeFeedback.update({
        where: { id: existing.id },
        data: { rating, reasonCodes, comment },
      });
      return NextResponse.json({ updated: true });
    }

    await prisma.narrativeFeedback.create({
      data: { narrativeId, rating, reasonCodes, comment },
    });

    return NextResponse.json({ created: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "narrative-feedback" } });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
