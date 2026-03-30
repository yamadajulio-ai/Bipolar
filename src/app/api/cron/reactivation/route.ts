import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma, withRetry } from "@/lib/db";
import { sendPush, type PushPayload, type PushResult } from "@/lib/web-push";

/**
 * Cron: Reactivation loop — nudge inactive users via Web Push.
 * Runs once daily (e.g. 14:00 BRT via Vercel Cron).
 *
 * Logic:
 * - 24h without check-in: gentle reminder
 * - 72h without check-in: "sentimos sua falta" message
 * - 7d without check-in: final soft nudge
 *
 * Safety:
 * - Never notify users who deleted account (cascade handles that)
 * - Never notify users who disabled reminders or push consent
 * - Never notify users who had check-in within the lookback
 * - Max 1 reactivation push per user per day (dedupe via MessageLog)
 * - Respects privacyMode and CommunicationPreference
 */

const TIERS = [
  {
    key: "24h",
    minHours: 24,
    maxHours: 72,
    payload: {
      title: "Como você está hoje?",
      body: "15 segundos para registrar — cada dia conta para entender seus padrões.",
      tag: "reactivation",
      url: "/checkin",
    } satisfies PushPayload,
  },
  {
    key: "72h",
    minHours: 72,
    maxHours: 168,
    payload: {
      title: "Seus dados continuam aqui",
      body: "Sem julgamento, sem pressa. Quando quiser voltar, estaremos prontos.",
      tag: "reactivation",
      url: "/hoje",
    } satisfies PushPayload,
  },
  {
    key: "7d",
    minHours: 168,
    maxHours: 720, // 30 days max — after that, stop nudging
    payload: {
      title: "Estamos por aqui",
      body: "Se precisar de apoio, o SOS e o CVV (188) estão disponíveis 24h.",
      tag: "reactivation",
      url: "/hoje",
    } satisfies PushPayload,
  },
];

const PRIVACY_PAYLOAD: PushPayload = {
  title: "Suporte Bipolar",
  body: "Você tem uma sugestão pendente.",
  tag: "reactivation",
  url: "/hoje",
};

/** Minimum hours between reactivation messages to the same user */
const DEDUP_HOURS = 24;

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const checkInId = Sentry.captureCheckIn({ monitorSlug: "reactivation-loop", status: "in_progress" });
  try {
    // Auth: Vercel Cron secret
    const authHeader = request.headers.get("authorization") ?? "";
    const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
    if (!process.env.CRON_SECRET || authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const dedupCutoff = new Date(now.getTime() - DEDUP_HOURS * 3600_000);
    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const tier of TIERS) {
      const cutoffMin = new Date(now.getTime() - tier.maxHours * 3600_000);
      const cutoffMax = new Date(now.getTime() - tier.minHours * 3600_000);

      // Find users who:
      // 1. Have push subscriptions
      // 2. Have reminders enabled (not opted out)
      // 3. Have push consent via CommunicationPreference (or no preference = default on)
      // 4. Last diary entry is between cutoffMin and cutoffMax
      // 5. Haven't received a reactivation push in DEDUP_HOURS (via MessageLog)
      const candidates = await withRetry(() => prisma.user.findMany({
        where: {
          onboarded: true,
          reminderSettings: {
            enabled: true,
          },
          pushSubscriptions: {
            some: {},
          },
          // Respect CommunicationPreference: either no pref (default on) or push=true
          OR: [
            { communicationPreference: null },
            { communicationPreference: { push: true } },
          ],
          // Last entry falls in the tier window
          entries: {
            none: {
              createdAt: { gte: cutoffMax },
            },
            some: {
              createdAt: { gte: cutoffMin },
            },
          },
          // Dedupe: no reactivation message in the last DEDUP_HOURS
          messageLogs: {
            none: {
              category: "reactivation",
              sentAt: { gte: dedupCutoff },
            },
          },
        },
        select: {
          id: true,
          reminderSettings: { select: { privacyMode: true } },
          pushSubscriptions: {
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          },
        },
        take: 200, // Safety cap per tier per run
      }));

      for (const user of candidates) {
        const payload = user.reminderSettings?.privacyMode
          ? PRIVACY_PAYLOAD
          : tier.payload;

        const results: PushResult[] = [];
        for (const sub of user.pushSubscriptions) {
          try {
            const result = await sendPush(sub, payload);
            results.push(result);
          } catch {
            results.push({ ok: false, reason: "transient" });
          }
        }

        const sent = results.some((r) => r.ok);
        if (sent) {
          totalSent++;
          // Log the message for deduplication
          await prisma.messageLog.create({
            data: {
              userId: user.id,
              channel: "push",
              category: "reactivation",
              tier: tier.key,
              delivered: true,
            },
          });
        } else {
          totalFailed++;
        }

        // Remove expired subscriptions
        const toRemove = user.pushSubscriptions
          .filter((_, i) => {
            const r = results[i];
            return r && !r.ok && (r.reason === "expired" || r.reason === "invalid-endpoint");
          })
          .map((s) => s.id);

        if (toRemove.length > 0) {
          await prisma.pushSubscription.deleteMany({
            where: { id: { in: toRemove } },
          });
        }
      }

      totalSkipped += Math.max(0, candidates.length - totalSent - totalFailed);
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: "reactivation-loop", status: "ok" });

    return NextResponse.json({
      ok: true,
      sent: totalSent,
      skipped: totalSkipped,
      failed: totalFailed,
    });
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "reactivation-loop", status: "error" });
    Sentry.captureException(err, { tags: { endpoint: "cron-reactivation" } });
    console.error(JSON.stringify({ event: "reactivation_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: (err as Error).message?.slice(0, 200) || "Unknown" }));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
