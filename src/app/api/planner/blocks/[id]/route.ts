import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
