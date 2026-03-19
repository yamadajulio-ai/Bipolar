import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { sendPush, type PushPayload, type PushResult } from "@/lib/web-push";
import { checkRateLimit } from "@/lib/security";

/**
 * Cron: Send Web Push reminders to users whose reminder time matches NOW.
 * Runs every minute via Vercel Cron.
 * Checks ReminderSettings for each user with push subscriptions.
 */

const reminderMessages: Record<string, PushPayload> = {
  wakeReminder: {
    title: "Bom dia! ☀️",
    body: "Hora de registrar como você acordou.",
    tag: "wake",
    url: "/sono",
  },
  sleepReminder: {
    title: "Hora de descansar 🌙",
    body: "Prepare-se para dormir. Registre seu dia.",
    tag: "sleep",
    url: "/checkin",
  },
  diaryReminder: {
    title: "Check-in do dia 📊",
    body: "Como está seu humor e energia hoje?",
    tag: "diary",
    url: "/checkin",
  },
  breathingReminder: {
    title: "Pausa para respirar 🫁",
    body: "Um minuto de respiração pode fazer diferença.",
    tag: "breathing",
    url: "/exercicios",
  },
};

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "send-reminders", status: "in_progress" },
    {
      schedule: { type: "crontab", value: "0 9 * * *" },
      checkinMargin: 5,
      maxRuntime: 2,
      timezone: "America/Sao_Paulo",
    },
  );

  try {
    // Current time in São Paulo (HH:MM)
    const now = new Date();

    // Idempotency: prevent duplicate sends if Vercel delivers the same cron event twice.
    // Key uses SP date+time so dedup is aligned with the user-facing schedule.
    const spDate = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // "2026-03-18"
    const spTime = now.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }); // "14:30"
    const cronKey = `cron:reminders:${spDate}T${spTime}`;
    const isFirstExecution = await checkRateLimit(cronKey, 1, 60_000);
    if (!isFirstExecution) {
      return NextResponse.json({ ok: true, sent: 0, dedupe: true });
    }

    // Find all users with push subscriptions AND matching reminder times
    const reminderKeys = Object.keys(reminderMessages) as Array<keyof typeof reminderMessages>;

    // Build OR conditions for each reminder field matching current time
    const orConditions = reminderKeys.map((key) => ({ [key]: spTime }));

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
      },
    });

    if (matchingSettings.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    const userIds = matchingSettings.map((s) => s.userId);

    // Fetch all push subscriptions for these users in one query
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // Group subscriptions by userId
    const subsByUser = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      const existing = subsByUser.get(sub.userId) || [];
      existing.push(sub);
      subsByUser.set(sub.userId, existing);
    }

    let sent = 0;
    let configErrorLogged = false;
    const expiredEndpoints: string[] = [];

    for (const settings of matchingSettings) {
      const userSubs = subsByUser.get(settings.userId);
      if (!userSubs || userSubs.length === 0) continue;

      // Determine which reminders fire now for this user
      const payloads: PushPayload[] = [];
      for (const key of reminderKeys) {
        const settingValue = settings[key as keyof typeof settings];
        if (settingValue === spTime) {
          payloads.push(reminderMessages[key]);
        }
      }

      // Send each payload to each subscription
      for (const payload of payloads) {
        for (const sub of userSubs) {
          const result: PushResult = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
          );
          if (result.ok) {
            sent++;
          } else if (result.reason === "expired") {
            // Only delete subscriptions confirmed expired (404/410)
            expiredEndpoints.push(sub.id);
          } else if (result.reason === "config" && !configErrorLogged) {
            // VAPID not configured — log once per cron run for visibility
            Sentry.captureMessage("Web Push VAPID not configured — reminders cannot be sent", { level: "warning" });
            configErrorLogged = true;
          }
          // Transient errors: keep subscription, retry next cycle.
        }
      }
    }

    // Clean up only confirmed expired subscriptions
    if (expiredEndpoints.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: expiredEndpoints } },
      });
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "ok" });
    return NextResponse.json({ ok: true, sent, cleaned: expiredEndpoints.length });
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "error" });
    Sentry.captureException(err, { tags: { endpoint: "cron-send-reminders" } });
    console.error("Send reminders cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
