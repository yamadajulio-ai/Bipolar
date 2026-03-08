import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAuthenticatedClient } from "./auth";
import {
  googleEventToBlockData,
  getCalendarColorId,
  isAllDayEvent,
  isLongEvent,
  listEvents,
} from "./calendar";

type PrismaPromise = Prisma.PrismaPromise<unknown>;

export interface SyncResult {
  pulled: number;
  errors: number;
  skippedAllDay?: number;
  skippedLong?: number;
  skippedCancelled?: number;
}

/**
 * Pull-only sync: imports events from Google Calendar into the planner.
 * Events are read-only in the app — all creation/editing happens in Google Calendar.
 *
 * Uses batched transactions to avoid Vercel timeout on large event sets.
 */
export async function pullGoogleCalendar(userId: string): Promise<SyncResult> {
  const auth = await getAuthenticatedClient(userId);
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  const isFullSync = !account.syncToken;

  // Fetch calendar default color (for events without custom colorId)
  const defaultColorId = await getCalendarColorId(auth, account.calendarId);

  let response;
  try {
    response = await listEvents(
      auth,
      account.calendarId,
      account.syncToken || undefined,
    );
  } catch (err) {
    console.error("[Google Sync] listEvents failed:", err);
    throw err;
  }

  const confirmed = response.items.filter((e) => e.status !== "cancelled" && e.id);
  const cancelled = response.items.filter((e) => e.status === "cancelled" && e.id);
  console.log(`[Google Sync] Got ${response.items.length} events (${confirmed.length} confirmed, ${cancelled.length} cancelled, fullSync=${isFullSync})`);

  // Full sync: delete all Google-sourced blocks first, then re-create.
  if (isFullSync) {
    const deleted = await prisma.plannerBlock.deleteMany({
      where: { userId, sourceType: "google" },
    });
    console.log(`[Google Sync] Deleted ${deleted.count} old google blocks`);
  }

  let skippedAllDay = 0;
  let skippedLong = 0;

  // ── Handle cancelled events (incremental sync only) ──
  // During full sync, blocks were already bulk-deleted above, so skip.
  let cancelledProcessed = 0;
  if (!isFullSync && cancelled.length > 0) {
    const cancelledIds = cancelled.map((e) => e.id!);
    // Single bulk delete instead of N individual queries
    const delResult = await prisma.plannerBlock.deleteMany({
      where: { userId, googleEventId: { in: cancelledIds } },
    });
    cancelledProcessed = delResult.count;
    console.log(`[Google Sync] Bulk-deleted ${cancelledProcessed} cancelled blocks`);
  }

  // ── Batch upserts for confirmed events ──
  const txOps: PrismaPromise[] = [];
  let pulled = 0;

  for (const event of confirmed) {
    if (isAllDayEvent(event)) {
      skippedAllDay++;
      continue;
    }
    if (isLongEvent(event)) {
      skippedLong++;
      continue;
    }

    const blockData = googleEventToBlockData(event, defaultColorId);
    txOps.push(
      prisma.plannerBlock.upsert({
        where: {
          userId_googleEventId: { userId, googleEventId: event.id! },
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
          googleEventId: event.id!,
          googleColor: blockData.googleColor,
          sourceType: "google",
        },
      }),
    );
    pulled++;
  }

  // Execute all upserts in batches of 50 to stay within DB limits
  const BATCH_SIZE = 50;
  let errors = 0;
  for (let i = 0; i < txOps.length; i += BATCH_SIZE) {
    const batch = txOps.slice(i, i + BATCH_SIZE);
    try {
      await prisma.$transaction(batch);
    } catch (err) {
      console.error(`[Google Sync] Batch ${i / BATCH_SIZE + 1} failed:`, err);
      errors += batch.length;
      pulled -= batch.length;
    }
  }

  console.log(`[Google Sync] Result: pulled=${pulled}, errors=${errors}, skippedAllDay=${skippedAllDay}, skippedLong=${skippedLong}, cancelledSkipped=${isFullSync ? cancelled.length : 0}, cancelledDeleted=${cancelledProcessed}`);

  // Update syncToken and lastSyncAt for next incremental sync
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      ...(response.nextSyncToken ? { syncToken: response.nextSyncToken } : {}),
      lastSyncAt: new Date(),
    },
  });

  return { pulled, errors, skippedAllDay, skippedLong, skippedCancelled: isFullSync ? cancelled.length : 0 } as SyncResult;
}
