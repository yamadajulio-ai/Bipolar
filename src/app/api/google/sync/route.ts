import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { pullGoogleCalendar } from "@/lib/google/sync";
import { getAuthenticatedClient } from "@/lib/google/auth";
import { listEvents, isAllDayEvent, isLongEvent } from "@/lib/google/calendar";

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

  // ?raw=1 — show what Google API returns (for debugging)
  if (url.searchParams.get("raw") === "1" && account) {
    try {
      const auth = await getAuthenticatedClient(session.userId);
      const response = await listEvents(auth, account.calendarId);
      const summary = response.items.map((ev) => ({
        id: ev.id?.slice(0, 20),
        title: ev.summary,
        status: ev.status,
        start: ev.start,
        end: ev.end,
        allDay: isAllDayEvent(ev),
        long: isLongEvent(ev),
        recurring: !!ev.recurringEventId,
      }));
      return NextResponse.json({
        totalFromGoogle: response.items.length,
        hasNextSyncToken: !!response.nextSyncToken,
        events: summary,
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
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
