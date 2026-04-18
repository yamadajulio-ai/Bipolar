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
 * Performance model:
 *   - Delete of stale blocks runs first (single deleteMany, scoped).
 *   - Upserts run in parallel batches (50 per batch, 3 concurrent) to fit inside
 *     the Vercel function budget. Recurring Google events expanded via
 *     `singleEvents: true` over a 21-day window can easily produce 300+ rows;
 *     a single sequential `$transaction([...])` hits Vercel's 30–60s ceiling.
 *   - Atomicity trade-off: if a batch fails, the errors counter is incremented
 *     and old blocks for that event id may persist. Next sync reconciles.
 */
export async function pullGoogleCalendar(userId: string): Promise<SyncResult> {
  const t0 = Date.now();
  const auth = await getAuthenticatedClient(userId);
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  const isFullSync = !account.syncToken;

  // Fetch calendar color + events in parallel (saves ~500ms)
  const [defaultColorId, response] = await Promise.all([
    getCalendarColorId(auth, account.calendarId),
    listEvents(auth, account.calendarId, account.syncToken || undefined),
  ]);
  const tFetch = Date.now();

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

  // ── Delete scope differs between full and incremental sync ──
  // Full sync: obsolete = every google block NOT in the fresh fetch. If the
  // calendar is now empty, nuke all google blocks for this user.
  // Incremental: only delete the specific cancelled event ids Google returned.
  try {
    if (isFullSync) {
      await prisma.plannerBlock.deleteMany({
        where: upsertedIds.length > 0
          ? { userId, sourceType: "google", googleEventId: { notIn: upsertedIds } }
          : { userId, sourceType: "google" },
      });
    } else if (cancelled.length > 0) {
      const cancelledIds = cancelled.map((e) => e.id!);
      const delResult = await prisma.plannerBlock.deleteMany({
        where: { userId, googleEventId: { in: cancelledIds } },
      });
      cancelledProcessed = delResult.count;
    }
  } catch (err) {
    // If delete fails we skip upserts too — otherwise we'd create duplicates
    // or mix fresh + stale. Surface the error and return with errors flag.
    console.error("[Google Sync] Delete step failed:", err);
    return { pulled: 0, errors: txOps.length, skippedAllDay, skippedLong, skippedCancelled: 0 };
  }
  const tDelete = Date.now();

  // ── Parallel batched upserts ──
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
  const tUpsert = Date.now();

  // Update syncToken and lastSyncAt
  await prisma.googleAccount.update({
    where: { userId },
    data: {
      ...(response.nextSyncToken ? { syncToken: response.nextSyncToken } : {}),
      lastSyncAt: new Date(),
    },
  });

  // Structured timing log — helps diagnose future slowness without verbosity
  console.log(JSON.stringify({
    event: "google_sync_done",
    userId,
    full: isFullSync,
    events: { confirmed: confirmed.length, cancelled: cancelled.length, skippedAllDay, skippedLong },
    upserts: { pulled, errors, batches: batches.length },
    ms: { fetch: tFetch - t0, delete: tDelete - tFetch, upsert: tUpsert - tDelete, total: Date.now() - t0 },
  }));

  return { pulled, errors, skippedAllDay, skippedLong, skippedCancelled: isFullSync ? cancelled.length : cancelledProcessed };
}
