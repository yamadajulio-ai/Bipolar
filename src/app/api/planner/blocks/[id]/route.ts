import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`planner_block_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const { id } = await params;
  try {
    const block = await prisma.plannerBlock.findUnique({
      where: { id },
      select: {
        id: true, userId: true, title: true, category: true, kind: true,
        isRoutine: true, startAt: true, endAt: true, notes: true,
        energyCost: true, stimulation: true, sourceType: true, googleEventId: true,
        googleColor: true, createdAt: true, updatedAt: true,
        recurrence: true, exceptions: true,
      },
    });

    if (!block || block.userId !== session.userId) {
      return NextResponse.json({ error: "Bloco não encontrado" }, { status: 404 });
    }

    return NextResponse.json(block, { headers: { "Cache-Control": "private, no-cache" } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "planner_block" } });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
