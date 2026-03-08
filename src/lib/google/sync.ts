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

  // Fetch calendar color + events in parallel (saves ~500ms)
  const [defaultColorId, response] = await Promise.all([
    getCalendarColorId(auth, account.calendarId),
    listEvents(auth, account.calendarId, account.syncToken || undefined),
  ]);

  const confirmed = response.items.filter((e) => e.status !== "cancelled" && e.id);
  const cancelled = response.items.filter((e) => e.status === "cancelled" && e.id);
  console.log(`[Google Sync] ${response.items.length} events (${confirmed.length} confirmed, ${cancelled.length} cancelled, fullSync=${isFullSync})`);

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
    const delResult = await prisma.plannerBlock.deleteMany({
      where: { userId, googleEventId: { in: cancelledIds } },
    });
    cancelledProcessed = delResult.count;
  }

  // ── Build upsert operations for confirmed events ──
  const txOps: PrismaPromise[] = [];

  for (const event of confirmed) {
    if (isAllDayEvent(event)) { skippedAllDay++; continue; }
    if (isLongEvent(event)) { skippedLong++; continue; }

    const d = googleEventToBlockData(event, defaultColorId);
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

  // Execute batches in parallel (3 concurrent transactions)
  const BATCH_SIZE = 50;
  const CONCURRENCY = 3;
  let errors = 0;
  let pulled = txOps.length;

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

  console.log(`[Google Sync] Done: pulled=${pulled}, errors=${errors}, skippedAllDay=${skippedAllDay}, skippedLong=${skippedLong}`);

  // Update syncToken and lastSyncAt
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      ...(response.nextSyncToken ? { syncToken: response.nextSyncToken } : {}),
      lastSyncAt: new Date(),
    },
  });

  return { pulled, errors, skippedAllDay, skippedLong, skippedCancelled: isFullSync ? cancelled.length : 0 };
}
