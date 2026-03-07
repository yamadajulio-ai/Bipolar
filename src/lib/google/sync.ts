import { prisma } from "@/lib/db";
import { getAuthenticatedClient } from "./auth";
import {
  googleEventToBlockData,
  getCalendarColorId,
  isAllDayEvent,
  isLongEvent,
  listEvents,
} from "./calendar";

export interface SyncResult {
  pulled: number;
  errors: number;
}

/**
 * Pull-only sync: imports events from Google Calendar into the planner.
 * Events are read-only in the app — all creation/editing happens in Google Calendar.
 */
export async function pullGoogleCalendar(userId: string): Promise<SyncResult> {
  const auth = await getAuthenticatedClient(userId);
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  let pulled = 0;
  let errors = 0;

  const isFullSync = !account.syncToken;

  // Fetch calendar default color (for events without custom colorId)
  const defaultColorId = await getCalendarColorId(auth, account.calendarId);

  const response = await listEvents(
    auth,
    account.calendarId,
    account.syncToken || undefined,
  );

  // Full sync: delete all Google-sourced blocks first, then re-create.
  // This handles events that were deleted in Google Calendar (which don't
  // appear in a full sync response — only incremental sync returns "cancelled").
  if (isFullSync) {
    await prisma.plannerBlock.deleteMany({
      where: { userId, sourceType: "google" },
    });
  }

  for (const event of response.items) {
    if (!event.id) continue;

    try {
      if (event.status === "cancelled") {
        // Event deleted in Google — delete from app
        await prisma.plannerBlock.deleteMany({
          where: { googleEventId: event.id, userId },
        });
        pulled++;
        continue;
      }

      // Skip all-day and excessively long events (>18h) — they pollute the planner
      if (isAllDayEvent(event) || isLongEvent(event)) continue;

      // Upsert Google event
      const blockData = googleEventToBlockData(event, defaultColorId);
      await prisma.plannerBlock.upsert({
        where: {
          userId_googleEventId: { userId, googleEventId: event.id },
        },
        update: {
          title: blockData.title,
          startAt: blockData.startAt,
          endAt: blockData.endAt,
          notes: blockData.notes,
          googleColor: blockData.googleColor,
        },
        create: {
          userId,
          title: blockData.title,
          category: blockData.category,
          kind: blockData.kind,
          startAt: blockData.startAt,
          endAt: blockData.endAt,
          notes: blockData.notes,
          energyCost: blockData.energyCost,
          stimulation: blockData.stimulation,
          googleEventId: event.id,
          googleColor: blockData.googleColor,
          sourceType: "google",
        },
      });
      pulled++;
    } catch {
      errors++;
    }
  }

  // Update syncToken and lastSyncAt for next incremental sync
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      ...(response.nextSyncToken ? { syncToken: response.nextSyncToken } : {}),
      lastSyncAt: new Date(),
    },
  });

  return { pulled, errors };
}
