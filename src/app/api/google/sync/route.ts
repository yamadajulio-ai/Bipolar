import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
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
    select: { calendarId: true, syncToken: true, lastSyncAt: true },
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

      // Get connected email to verify which account is linked
      let connectedEmail: string | null = null;
      try {
        const { google: g } = await import("googleapis");
        const oauth2 = g.oauth2({ version: "v2", auth });
        const userInfo = await oauth2.userinfo.get();
        connectedEmail = userInfo.data.email || null;
      } catch { /* scope may not allow this */ }

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
        connectedEmail,
        totalFromGoogle: response.items.length,
        confirmedCount: response.items.filter((e) => e.status === "confirmed").length,
        cancelledCount: response.items.filter((e) => e.status === "cancelled").length,
        hasNextSyncToken: !!response.nextSyncToken,
        confirmedEvents: summary.filter((e) => e.status === "confirmed").map((e) => e.title),
        events: summary.slice(0, 20), // limit to first 20
      });
    } catch (err) {
      Sentry.captureException(err, { tags: { endpoint: "google-sync-raw" } });
      return NextResponse.json({ error: "Erro na sincronização" }, { status: 500 });
    }
  }

  // ?calendars=1 — list all calendars and sample events from each
  if (url.searchParams.get("calendars") === "1" && account) {
    try {
      const auth = await getAuthenticatedClient(session.userId);
      const { google: g } = await import("googleapis");
      const cal = g.calendar({ version: "v3", auth });

      const calList = await cal.calendarList.list();
      const calendars = calList.data.items || [];

      const results = [];
      for (const c of calendars) {
        if (!c.id) continue;
        try {
          const evRes = await cal.events.list({
            calendarId: c.id,
            timeMin: new Date(Date.now() - 7 * 86400000).toISOString(),
            timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
            singleEvents: true,
            maxResults: 10,
            showDeleted: false,
          });
          results.push({
            calendarId: c.id,
            summary: c.summary,
            primary: c.primary || false,
            accessRole: c.accessRole,
            eventCount: evRes.data.items?.length || 0,
            sampleEvents: (evRes.data.items || []).slice(0, 5).map((e) => ({
              title: e.summary,
              start: e.start,
            })),
          });
        } catch (err) {
          results.push({
            calendarId: c.id,
            summary: c.summary,
            error: String(err),
          });
        }
      }
      return NextResponse.json({ calendars: results, storedCalendarId: account.calendarId });
    } catch (err) {
      Sentry.captureException(err, { tags: { endpoint: "google-sync-calendars" } });
      return NextResponse.json({ error: "Erro na sincronização" }, { status: 500 });
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
    select: { id: true, calendarId: true, syncToken: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Google Agenda não conectado" },
      { status: 400 },
    );
  }

  // Rate limit: 10 syncs per hour per user
  const allowed = await checkRateLimit(`google-sync:${session.userId}`, 10, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas sincronizações. Tente novamente em breve." },
      { status: 429 },
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
    Sentry.captureException(err, { tags: { endpoint: "google-sync" } });
    console.error("[Google Sync] Error:", message, err);
    return NextResponse.json(
      { error: `Erro na sincronização: ${message}` },
      { status: 500 },
    );
  }
}
