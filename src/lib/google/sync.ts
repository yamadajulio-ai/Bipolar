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
  /** Set when we couldn't acquire the per-user advisory lock (another sync in progress). */
  skipped?: boolean;
}

/**
 * 32-bit signed integer hash of a UUID — input for pg_try_advisory_lock.
 * pg_try_advisory_lock(bigint) takes a 64-bit int; we fit a 32-bit hash comfortably.
 */
function userIdToLockKey(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Pull-only sync: imports events from Google Calendar into the planner.
 * Events are read-only in the app — all creation/editing happens in Google Calendar.
 *
 * Concurrency: guarded by a per-user pg_try_advisory_lock so foreground
 * (/hoje SSR sync) and background (waitUntil, user manual click) calls on the
 * same userId don't race — only one holds the lock at a time, the rest return
 * `{ skipped: true }` harmlessly.
 *
 * Cursor semantics: nextSyncToken and lastSyncAt only advance when errors === 0.
 * A partial failure keeps the old cursor so the next sync retries the same
 * changes from Google — losing no events. `lastAttemptAt` (best-effort) is
 * bumped regardless so /hoje's 5-minute staleness check doesn't thrash.
 */
export async function pullGoogleCalendar(userId: string): Promise<SyncResult> {
  const t0 = Date.now();

  // ── Per-user advisory lock — skip if another sync is already running ──
  const lockKey = userIdToLockKey(userId);
  const lockRows = await prisma.$queryRaw<{ locked: boolean }[]>(
    Prisma.sql`SELECT pg_try_advisory_lock(${lockKey}) AS locked`,
  );
  if (!lockRows[0]?.locked) {
    console.log(JSON.stringify({ event: "google_sync_skipped_locked", userId }));
    return { pulled: 0, errors: 0, skippedAllDay: 0, skippedLong: 0, skipped: true };
  }

  try {
    const auth = await getAuthenticatedClient(userId);
    const account = await prisma.googleAccount.findUnique({ where: { userId } });
    if (!account) throw new Error("Google account not linked");

    // Fetch calendar color + events in parallel (saves ~500ms)
    const [defaultColorId, response] = await Promise.all([
      getCalendarColorId(auth, account.calendarId),
      listEvents(auth, account.calendarId, account.syncToken || undefined),
    ]);
    const tFetch = Date.now();

    // `didFullList` is authoritative: true when no syncToken was sent OR 410
    // GONE forced a full fallback. Local reconciliation MUST follow full-sync
    // semantics in either case.
    const isFullSync = response.didFullList;

    const confirmed = response.items.filter((e) => e.status !== "cancelled" && e.id);
    const cancelled = response.items.filter((e) => e.status === "cancelled" && e.id);

    let skippedAllDay = 0;
    let skippedLong = 0;

    // ── Build upsert operations for confirmed events ──
    const txOps: PrismaPromise[] = [];
    const upsertedIds: string[] = [];
    // IDs filtered out because the event is now all-day/long. In INCREMENTAL
    // mode, these must be deleted from the DB — the user saw them before the
    // transition, and we're now deciding to ignore them. Full sync already
    // handles this via notIn(upsertedIds).
    const filteredOutIds: string[] = [];

    for (const event of confirmed) {
      if (isAllDayEvent(event)) {
        skippedAllDay++;
        if (event.id) filteredOutIds.push(event.id);
        continue;
      }
      if (isLongEvent(event)) {
        skippedLong++;
        if (event.id) filteredOutIds.push(event.id);
        continue;
      }

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

    // ── Delete scope ──
    // Full: obsolete = every google block NOT in the fresh fetch.
    //       If the fetch is empty, wipe all google blocks for this user.
    // Incremental: cancelled Google ids + ids that transitioned to all-day/long
    //              (would be phantom rows otherwise).
    try {
      if (isFullSync) {
        await prisma.plannerBlock.deleteMany({
          where: upsertedIds.length > 0
            ? { userId, sourceType: "google", googleEventId: { notIn: upsertedIds } }
            : { userId, sourceType: "google" },
        });
      } else {
        const cancelledIds = cancelled.map((e) => e.id!).filter(Boolean);
        const idsToDelete = [...cancelledIds, ...filteredOutIds];
        if (idsToDelete.length > 0) {
          const delResult = await prisma.plannerBlock.deleteMany({
            where: { userId, sourceType: "google", googleEventId: { in: idsToDelete } },
          });
          cancelledProcessed = delResult.count;
        }
      }
    } catch (err) {
      // If delete fails we skip upserts AND do not advance the cursor — next
      // sync retries cleanly.
      console.error("[Google Sync] Delete step failed:", err);
      // Bump lastSyncAt as an attempt marker to prevent /hoje staleness retry-storm.
      await prisma.googleAccount.update({
        where: { userId },
        data: { lastSyncAt: new Date() },
      }).catch(() => {});
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

    // ── Update account cursor — ONLY advance syncToken when no errors ──
    // lastSyncAt is bumped always (prevents /hoje retry-storm), but the cursor
    // moves only on full success. Partial failure = next sync replays the same
    // changes from Google against the OLD cursor.
    const cursorShouldAdvance = errors === 0;
    await prisma.googleAccount.update({
      where: { userId },
      data: {
        ...(cursorShouldAdvance && response.nextSyncToken
          ? { syncToken: response.nextSyncToken }
          : {}),
        lastSyncAt: new Date(),
      },
    });

    // Structured timing log
    console.log(JSON.stringify({
      event: "google_sync_done",
      userId,
      full: isFullSync,
      cursorAdvanced: cursorShouldAdvance,
      events: { confirmed: confirmed.length, cancelled: cancelled.length, skippedAllDay, skippedLong, filteredOutDeleted: isFullSync ? 0 : filteredOutIds.length },
      upserts: { pulled, errors, batches: batches.length },
      ms: { fetch: tFetch - t0, delete: tDelete - tFetch, upsert: tUpsert - tDelete, total: Date.now() - t0 },
    }));

    return { pulled, errors, skippedAllDay, skippedLong, skippedCancelled: isFullSync ? cancelled.length : cancelledProcessed };
  } finally {
    // Release advisory lock. Use raw so a failure here doesn't shadow upstream errors.
    await prisma.$queryRaw(Prisma.sql`SELECT pg_advisory_unlock(${lockKey})`).catch(() => {});
  }
}
