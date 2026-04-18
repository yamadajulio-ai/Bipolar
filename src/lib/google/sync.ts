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
 * Full sync uses an atomic transaction (delete-stale + upsert-fresh together) so
 * a partial batch failure can never leave the user with zero events.
 */
export async function pullGoogleCalendar(userId: string): Promise<SyncResult> {
  const auth = await getAuthenticatedClient(userId);
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  const isFullSync = !account.syncToken;

  // Fetch calendar color + events in parallel (saves ~500ms)
  const [defaultColorId, response] = await Promise.all([
    getCalendarColorId(auth, account.calendarId),
    listEvents(auth, account.calendarId, account.syncToken || undefined),
  ]);

  const confirmed = response.items.filter((e) => e.status !== "cancelled" && e.id);
  const cancelled = response.items.filter((e) => e.status === "cancelled" && e.id);

  let skippedAllDay = 0;
  let skippedLong = 0;

  // ── Build upsert operations for confirmed events ──
  const txOps: PrismaPromise[] = [];
  const upsertedIds: string[] = [];

  for (const event of confirmed) {
    if (isAllDayEvent(event)) { skippedAllDay++; continue; }
    if (isLongEvent(event)) { skippedLong++; continue; }

    const d = googleEventToBlockData(event, defaultColorId);
    upsertedIds.push(event.id!);
    txOps.push(
      prisma.plannerBlock.upsert({
        where: { userId_googleEventId: { userId, googleEventId: event.id! } },
        update: {
          title: d.title, startAt: d.startAt, endAt: d.endAt,
          notes: d.notes, googleColor: d.googleColor,
        },
        create: {
          userId, title: d.title, category: d.category, kind: d.kind,
          startAt: d.startAt, endAt: d.endAt, notes: d.notes,
          energyCost: d.energyCost, stimulation: d.stimulation,
          googleEventId: event.id!, googleColor: d.googleColor,
          sourceType: "google",
        },
      }),
    );
  }

  let errors = 0;
  let pulled = txOps.length;
  let cancelledProcessed = 0;

  if (isFullSync) {
    if (txOps.length === 0) {
      // Empty Google Calendar — don't wipe anything, just refresh sync metadata below.
      pulled = 0;
    } else {
      // Atomic replace: delete stale Google blocks AND upsert fresh ones in the
      // same transaction. If the transaction fails, the user keeps existing blocks.
      try {
        await prisma.$transaction([
          prisma.plannerBlock.deleteMany({
            where: {
              userId,
              sourceType: "google",
              googleEventId: { notIn: upsertedIds },
            },
          }),
          ...txOps,
        ]);
      } catch (err) {
        console.error("[Google Sync] Full-sync transaction failed:", err);
        errors = txOps.length;
        pulled = 0;
      }
    }
  } else {
    // Incremental sync: delete cancelled events + upsert in batches.
    if (cancelled.length > 0) {
      const cancelledIds = cancelled.map((e) => e.id!);
      const delResult = await prisma.plannerBlock.deleteMany({
        where: { userId, googleEventId: { in: cancelledIds } },
      });
      cancelledProcessed = delResult.count;
    }

    const BATCH_SIZE = 50;
    const CONCURRENCY = 3;
    const batches: PrismaPromise[][] = [];
    for (let i = 0; i < txOps.length; i += BATCH_SIZE) {
      batches.push(txOps.slice(i, i + BATCH_SIZE));
    }
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((batch) => prisma.$transaction(batch)),
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "rejected") {
          console.error(`[Google Sync] Batch ${i + j + 1} failed:`, (results[j] as PromiseRejectedResult).reason);
          errors += chunk[j].length;
          pulled -= chunk[j].length;
        }
      }
    }
  }

  // Update syncToken and lastSyncAt
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      ...(response.nextSyncToken ? { syncToken: response.nextSyncToken } : {}),
      lastSyncAt: new Date(),
    },
  });

  return { pulled, errors, skippedAllDay, skippedLong, skippedCancelled: isFullSync ? cancelled.length : cancelledProcessed };
}
