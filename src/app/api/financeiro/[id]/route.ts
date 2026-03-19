import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const HEADERS = { "Cache-Control": "no-store" };
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_item_write:${session.userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  const { id } = await params;

  try {
    const tx = await prisma.financialTransaction.findUnique({ where: { id } });

    if (!tx || tx.userId !== session.userId) {
      return NextResponse.json({ error: "Transação não encontrada" }, { status: 404, headers: HEADERS });
    }

    await prisma.financialTransaction.delete({ where: { id } });

    return NextResponse.json({ ok: true }, { headers: HEADERS });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro_item" } });
    return NextResponse.json({ error: "Erro interno" }, { status: 500, headers: HEADERS });
  }
}
