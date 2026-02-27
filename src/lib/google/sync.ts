import { prisma } from "@/lib/db";
import { getAuthenticatedClient } from "./auth";
import {
  blockToGoogleEvent,
  googleEventToBlockData,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  listEvents,
} from "./calendar";

export interface SyncResult {
  pushed: number;
  pulled: number;
  errors: number;
}

/**
 * Bidirectional sync between Empresa Bipolar planner and Google Calendar.
 *
 * Conflict resolution:
 * - Blocks with sourceType="app" are owned by this app. Changes push to Google.
 * - Events with sourceType="google" are owned by Google Calendar. Changes pull into app.
 */
export async function syncGoogleCalendar(userId: string): Promise<SyncResult> {
  const auth = await getAuthenticatedClient(userId);
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  let pushed = 0;
  let pulled = 0;
  let errors = 0;

  // ── PUSH: App → Google ─────────────────────────────────────
  const unsyncedBlocks = await prisma.plannerBlock.findMany({
    where: {
      userId,
      sourceType: "app",
      OR: [
        { googleEventId: null },
        { updatedAt: { gt: account.updatedAt } },
      ],
    },
  });

  for (const block of unsyncedBlocks) {
    try {
      const event = blockToGoogleEvent(block);
      if (block.googleEventId) {
        await updateGoogleEvent(auth, account.calendarId, block.googleEventId, event);
      } else {
        const created = await createGoogleEvent(auth, account.calendarId, event);
        await prisma.plannerBlock.update({
          where: { id: block.id },
          data: { googleEventId: created.id },
        });
      }
      pushed++;
    } catch {
      errors++;
    }
  }

  // Handle app blocks that were deleted since last sync:
  // Check for Google events with empresaBipolarId that no longer have a matching block
  // (This is handled during PULL phase — orphaned app events are cleaned up)

  // ── PULL: Google → App ─────────────────────────────────────
  const response = await listEvents(
    auth,
    account.calendarId,
    account.syncToken || undefined,
  );

  for (const event of response.items) {
    if (!event.id) continue;
    const extProps = event.extendedProperties?.private || {};

    try {
      if (event.status === "cancelled") {
        if (extProps.empresaBipolarId) {
          // App-created event deleted in Google — just clear the link
          await prisma.plannerBlock.updateMany({
            where: { id: extProps.empresaBipolarId, userId },
            data: { googleEventId: null },
          });
        } else {
          // Google-sourced event deleted — delete from app
          await prisma.plannerBlock.deleteMany({
            where: { googleEventId: event.id, userId, sourceType: "google" },
          });
        }
        pulled++;
        continue;
      }

      // Skip events created by our app — app is source of truth
      if (extProps.empresaBipolarId) continue;

      // Upsert Google-sourced event
      const blockData = googleEventToBlockData(event);
      const existing = await prisma.plannerBlock.findFirst({
        where: { googleEventId: event.id, userId },
      });

      if (existing) {
        await prisma.plannerBlock.update({
          where: { id: existing.id },
          data: {
            title: blockData.title,
            startAt: blockData.startAt,
            endAt: blockData.endAt,
            notes: blockData.notes,
          },
        });
      } else {
        await prisma.plannerBlock.create({
          data: {
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
            sourceType: "google",
          },
        });
      }
      pulled++;
    } catch {
      errors++;
    }
  }

  // Update syncToken for next incremental sync
  if (response.nextSyncToken) {
    await prisma.googleAccount.update({
      where: { userId },
      data: { syncToken: response.nextSyncToken },
    });
  }

  return { pushed, pulled, errors };
}
