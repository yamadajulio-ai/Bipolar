import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pullGoogleCalendar } from "@/lib/google/sync";

export const maxDuration = 30;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const account = await prisma.googleAccount.findUnique({
    where: { userId: session.userId },
  });

  const url = new URL(request.url);
  if (url.searchParams.get("debug") === "1" && account) {
    const googleBlocks = await prisma.plannerBlock.findMany({
      where: { userId: session.userId, sourceType: "google" },
      select: { id: true, title: true, startAt: true, endAt: true, googleEventId: true },
      orderBy: { startAt: "asc" },
      take: 50,
    });
    const allBlocks = await prisma.plannerBlock.count({
      where: { userId: session.userId },
    });
    const googleBlockCount = await prisma.plannerBlock.count({
      where: { userId: session.userId, sourceType: "google" },
    });
    return NextResponse.json({
      connected: true,
      calendarId: account.calendarId,
      hasSyncToken: !!account.syncToken,
      lastSyncAt: account.lastSyncAt,
      totalBlocks: allBlocks,
      googleBlocks: googleBlockCount,
      blocks: googleBlocks,
    });
  }

  return NextResponse.json({ connected: !!account });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const account = await prisma.googleAccount.findUnique({
    where: { userId: session.userId },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Google Calendar não conectado" },
      { status: 400 },
    );
  }

  // ?full=1 resets syncToken to force a complete re-sync
  const url = new URL(request.url);
  if (url.searchParams.get("full") === "1") {
    await prisma.googleAccount.update({
      where: { userId: session.userId },
      data: { syncToken: null },
    });
  }

  try {
    const result = await pullGoogleCalendar(session.userId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Google Sync] Error:", message, err);
    return NextResponse.json(
      { error: `Erro na sincronização: ${message}` },
      { status: 500 },
    );
  }
}
