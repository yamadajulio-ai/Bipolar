import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { sendPush, type PushPayload, type PushResult } from "@/lib/web-push";
import { checkRateLimit, isRateLimited } from "@/lib/security";
import { isWhatsAppConfigured, sendWhatsAppReminder, WHATSAPP_REMINDER_TEMPLATES } from "@/lib/whatsapp";

/**
 * Cron: Send Web Push reminders to users whose reminder time matches NOW.
 * Runs every minute via Vercel Cron.
 *
 * Dedupe strategy (split inflight/sent):
 * 1. Check "sent:{key}" marker (read-only) → skip if already delivered.
 * 2. Acquire "inflight:{key}" lock (short 90s TTL) → skip if another worker is processing.
 * 3. Send pushes.
 * 4. If ≥1 success → mark "sent:{key}" (5-min TTL, prevents re-delivery).
 * 5. "inflight" lock auto-expires — no manual release needed, no race condition.
 */

const reminderMessages: Record<string, PushPayload> = {
  wakeReminder: {
    title: "Bom dia!",
    body: "Que tal fazer um registro rápido?",
    tag: "wake",
    url: "/sono",
  },
  sleepReminder: {
    title: "Boa noite!",
    body: "Hora de fazer seu registro antes de dormir.",
    tag: "sleep",
    url: "/checkin",
  },
  diaryReminder: {
    title: "Suporte Bipolar",
    body: "Que tal fazer um registro rápido?",
    tag: "diary",
    url: "/checkin",
  },
  breathingReminder: {
    title: "Suporte Bipolar",
    body: "Você tem um lembrete.",
    tag: "breathing",
    url: "/exercicios",
  },
};

// Privacy mode: generic text AND neutral URL that hide all health context on lock screens.
// Semantic URLs like /sono, /checkin would leak context via notification history/analytics.
const PRIVACY_PAYLOAD: PushPayload = {
  title: "Suporte Bipolar",
  body: "Você tem um lembrete pendente.",
  tag: "reminder",
  url: "/hoje",
};

// Short-lived lock to prevent concurrent cron workers from processing the same reminder.
// 90s is enough for the batch + cleanup, and auto-expires without manual release.
const INFLIGHT_TTL_MS = 90_000;

// After successful delivery, block re-sends for 5 minutes.
// Covers the ±2 min lookback window with margin.
const SENT_TTL_MS = 5 * 60_000;

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Kill switch: disable push notifications entirely
  if (process.env.KILL_PUSH_NOTIFICATIONS === "true") {
    return NextResponse.json({ skipped: true, reason: "kill_switch" });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "send-reminders", status: "in_progress" },
    {
      schedule: { type: "crontab", value: "* * * * *" },
      checkinMargin: 5,
      maxRuntime: 2,
      timezone: "America/Sao_Paulo",
    },
  );

  try {
    // Current time in São Paulo
    const now = new Date();

    const spDate = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const spTime = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }); // "14:30"

    // Lookback window: also check ±2 minutes to handle cron delays/skips.
    // This ensures reminders aren't lost if Vercel delivers the cron late.
    const lookbackTimes = new Set<string>([spTime]);
    for (const offset of [-2, -1, 1, 2]) {
      const d = new Date(now.getTime() + offset * 60_000);
      lookbackTimes.add(d.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }));
    }

    // Find all users with reminder times matching current window.
    const reminderKeys = Object.keys(reminderMessages) as Array<keyof typeof reminderMessages>;

    // Build OR conditions: match any time in the lookback window
    const orConditions = reminderKeys.flatMap((key) =>
      [...lookbackTimes].map((time) => ({ [key]: time })),
    );

    const matchingSettings = await prisma.reminderSettings.findMany({
      where: {
        enabled: true,
        OR: orConditions,
      },
      select: {
        userId: true,
        wakeReminder: true,
        sleepReminder: true,
        diaryReminder: true,
        breathingReminder: true,
        privacyMode: true,
      },
    });

    if (matchingSettings.length === 0) {
      Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "ok" });
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const userIds = matchingSettings.map((s) => s.userId);

    // Fetch all push subscriptions for these users in one query
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true },
    });

    if (subscriptions.length === 0) {
      Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "ok" });
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Group subscriptions by userId
    const subsByUser = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const existing = subsByUser.get(sub.userId) || [];
      existing.push(sub);
      subsByUser.set(sub.userId, existing);
    }

    interface SendTask {
      subId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      payload: PushPayload;
      baseKey: string; // for marking sent after success
    }

    const tasks: SendTask[] = [];
    // Track which base keys were acquired (inflight) so we can mark sent after success
    const acquiredKeys = new Set<string>();

    for (const settings of matchingSettings) {
      const userSubs = subsByUser.get(settings.userId);
      if (!userSubs || userSubs.length === 0) continue;

      // Determine which reminders fire now for this user (match any time in window)
      const payloads: { key: string; payload: PushPayload; scheduledTime: string }[] = [];
      for (const key of reminderKeys) {
        const settingValue = settings[key as keyof typeof settings];
        if (typeof settingValue === "string" && lookbackTimes.has(settingValue)) {
          payloads.push({ key, payload: reminderMessages[key], scheduledTime: settingValue });
        }
      }

      for (const { key, payload, scheduledTime } of payloads) {
        const baseKey = `reminder:${settings.userId}:${key}:${spDate}T${scheduledTime}`;

        // Phase 1: Already delivered? (read-only, no increment)
        const alreadySent = await isRateLimited(`sent:${baseKey}`, 1);
        if (alreadySent) continue;

        // Phase 2: Acquire short-lived inflight lock (prevents concurrent workers)
        const acquired = await checkRateLimit(`inflight:${baseKey}`, 1, INFLIGHT_TTL_MS);
        if (!acquired) continue;

        acquiredKeys.add(baseKey);
        // Privacy mode: use fully generic payload (no semantic URL leak)
        const effectivePayload = settings.privacyMode ? PRIVACY_PAYLOAD : payload;
        for (const sub of userSubs) {
          tasks.push({
            subId: sub.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            payload: effectivePayload,
            baseKey,
          });
        }
      }
    }

    let sent = 0;
    let configErrorLogged = false;
    const expiredIds: string[] = [];
    let badRequestCount = 0;
    const badRequestSubIds: string[] = []; // subs that got 400 — checked for strike-out

    // Track which base keys had at least one successful delivery
    const deliveredKeys = new Set<string>();

    // Send in concurrent batches of 10 to balance speed vs resource usage
    const BATCH_SIZE = 10;
    for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
      const batch = tasks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (task) => {
          const result: PushResult = await sendPush(
            { endpoint: task.endpoint, p256dh: task.p256dh, auth: task.auth },
            task.payload,
          );
          return { task, result };
        }),
      );

      for (const settled of results) {
        if (settled.status === "rejected") continue; // logged by sendPush
        const { task, result } = settled.value;
        if (result.ok) {
          sent++;
          deliveredKeys.add(task.baseKey);
        } else if (result.reason === "expired") {
          // 404/410 = subscription genuinely gone — safe to delete
          expiredIds.push(task.subId);
        } else if (result.reason === "invalid-endpoint") {
          // Non-allowlisted legacy endpoint — safe to delete
          expiredIds.push(task.subId);
        } else if (result.reason === "bad-request") {
          // 400 = subscription may be permanently invalid.
          // Track strikes: delete after 3 consecutive 400s (rules out transient issues).
          badRequestCount++;
          badRequestSubIds.push(task.subId);
        } else if (result.reason === "config" && !configErrorLogged) {
          Sentry.captureMessage("Web Push VAPID not configured — reminders cannot be sent", { level: "warning" });
          configErrorLogged = true;
        }
        // "transient" (403/429/5xx/network) — do NOT delete, retry later
      }
    }

    // Phase 4: Mark delivered keys with longer TTL to prevent re-sends.
    // Only keys with ≥1 successful push get the "sent" marker.
    // If ALL sends failed, no marker → inflight lock expires in 90s → next cron can retry.
    if (deliveredKeys.size > 0) {
      await Promise.allSettled(
        [...deliveredKeys].map((key) => checkRateLimit(`sent:${key}`, 1, SENT_TTL_MS)),
      );
    }

    // Strike-based cleanup for persistent 400s.
    // After 3 consecutive 400 responses (across cron runs), the subscription is dead.
    // Uses rate limiter as strike counter: 3 strikes within 24h → delete.
    const BAD_REQUEST_STRIKE_TTL_MS = 24 * 60 * 60_000;
    const BAD_REQUEST_MAX_STRIKES = 3;
    for (const subId of badRequestSubIds) {
      const withinLimit = await checkRateLimit(`push:400:${subId}`, BAD_REQUEST_MAX_STRIKES, BAD_REQUEST_STRIKE_TTL_MS);
      if (!withinLimit) {
        // 3rd strike — subscription is permanently broken
        expiredIds.push(subId);
      }
    }

    // Log bad-request count if any (for operational visibility without leaking PHI)
    if (badRequestCount > 0) {
      Sentry.captureMessage("Web Push: subscriptions returning 400", {
        level: "warning",
        tags: { feature: "web-push", event: "bad_request_subscriptions" },
        extra: { count: badRequestCount },
      });
    }

    // Clean up confirmed-dead subscriptions (expired + invalid-endpoint + 3x 400 strikeout)
    if (expiredIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: expiredIds } },
      });
    }

    // ── WhatsApp channel (parallel to push, same time matching) ──
    let whatsappSent = 0;
    if (isWhatsAppConfigured()) {
      // Find users with WhatsApp enabled + valid phone + active consent
      const waUsers = await prisma.communicationPreference.findMany({
        where: {
          whatsapp: true,
          userId: { in: userIds },
        },
        select: { userId: true },
      });

      if (waUsers.length > 0) {
        const waUserIds = waUsers.map((u) => u.userId);

        // Fetch phones for WhatsApp users
        const waPhones = await prisma.user.findMany({
          where: { id: { in: waUserIds }, whatsappPhone: { not: null } },
          select: { id: true, whatsappPhone: true },
        });
        const phoneByUser = new Map(waPhones.map((u) => [u.id, u.whatsappPhone!]));

        // Verify active consent for each user
        const waConsents = await prisma.consent.findMany({
          where: { userId: { in: waUserIds }, scope: "whatsapp", revokedAt: null },
          select: { userId: true },
        });
        const consentedUsers = new Set(waConsents.map((c) => c.userId));

        for (const s of matchingSettings) {
          const phone = phoneByUser.get(s.userId);
          if (!phone || !consentedUsers.has(s.userId)) continue;

          for (const key of reminderKeys) {
            const settingValue = s[key as keyof typeof s];
            if (typeof settingValue !== "string" || !lookbackTimes.has(settingValue)) continue;
            if (!(key in WHATSAPP_REMINDER_TEMPLATES)) continue;

            const waKey = `wa:reminder:${s.userId}:${key}:${spDate}T${settingValue}`;

            // Dedupe: skip if already sent
            const alreadySentWa = await isRateLimited(`sent:${waKey}`, 1);
            if (alreadySentWa) continue;

            const acquired = await checkRateLimit(`inflight:${waKey}`, 1, INFLIGHT_TTL_MS);
            if (!acquired) continue;

            const result = await sendWhatsAppReminder(
              phone,
              key as keyof typeof WHATSAPP_REMINDER_TEMPLATES,
            );

            if (result.success) {
              whatsappSent++;
              await checkRateLimit(`sent:${waKey}`, 1, SENT_TTL_MS);

              // Log for audit trail
              await prisma.messageLog.create({
                data: {
                  userId: s.userId,
                  channel: "whatsapp",
                  category: "reminder",
                  delivered: true,
                },
              });
            }
          }
        }
      }
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "ok" });
    return NextResponse.json({ ok: true, sent, whatsappSent, cleaned: expiredIds.length });
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "error" });
    Sentry.captureException(err, { tags: { endpoint: "cron-send-reminders" } });
    // Structured error log: no raw err object, only classification
    console.error(JSON.stringify({
      event: "cron_send_reminders_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: err instanceof Error ? err.message.slice(0, 100) : "Unknown error",
    }));
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
