import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

export async function DELETE() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`google_disconnect:${session.userId}`, 10, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
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
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "google_disconnect" } });
    return NextResponse.json(
      { error: "Erro ao desconectar Google Calendar" },
      { status: 500 },
    );
  }
}
