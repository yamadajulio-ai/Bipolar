import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { syncGoogleCalendar } from "@/lib/google/sync";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const account = await prisma.googleAccount.findUnique({
    where: { userId: session.userId },
  });

  return NextResponse.json({ connected: !!account });
}

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const account = await prisma.googleAccount.findUnique({
    where: { userId: session.userId },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Google Calendar nao conectado" },
      { status: 400 },
    );
  }

  try {
    const result = await syncGoogleCalendar(session.userId);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Erro na sincronizacao com Google Calendar" },
      { status: 500 },
    );
  }
}
