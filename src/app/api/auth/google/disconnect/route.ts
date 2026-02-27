import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function DELETE() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  try {
    // Delete blocks sourced from Google
    await prisma.plannerBlock.deleteMany({
      where: { userId: session.userId, sourceType: "google" },
    });

    // Clear googleEventId on app blocks
    await prisma.plannerBlock.updateMany({
      where: { userId: session.userId },
      data: { googleEventId: null },
    });

    // Delete Google account link
    await prisma.googleAccount.deleteMany({
      where: { userId: session.userId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Erro ao desconectar Google Calendar" },
      { status: 500 },
    );
  }
}
