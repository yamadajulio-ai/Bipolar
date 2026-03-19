import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

/**
 * PATCH /api/sono/excluir — Toggle excluded flag on a sleep log.
 * Body: { id: string, excluded: boolean }
 */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`sono_excluir_write:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  try {
    const { id, excluded } = await request.json();
    if (typeof id !== "string" || typeof excluded !== "boolean") {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Ensure user owns this record
    const log = await prisma.sleepLog.findFirst({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!log) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }

    const updated = await prisma.sleepLog.update({
      where: { id },
      data: { excluded },
      select: { id: true, excluded: true },
    });

    return NextResponse.json({ id: updated.id, excluded: updated.excluded });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "sono_excluir" } });
    return NextResponse.json({ error: "Erro ao atualizar registro" }, { status: 500 });
  }
}
