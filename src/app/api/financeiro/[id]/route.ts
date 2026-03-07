import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const HEADERS = { "Cache-Control": "no-store" };
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const { id } = await params;
  const tx = await prisma.financialTransaction.findUnique({ where: { id } });

  if (!tx || tx.userId !== session.userId) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404, headers: HEADERS });
  }

  await prisma.financialTransaction.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { headers: HEADERS });
}
