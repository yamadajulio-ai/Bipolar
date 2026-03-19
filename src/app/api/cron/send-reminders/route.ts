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
      schedule: { type: "crontab", value: "* * * * *" },
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

    // Build all send tasks, then execute concurrently with Promise.allSettled
    // to avoid sequential awaits that risk timeout at scale.
    interface SendTask {
      subId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      payload: PushPayload;
    }

    const tasks: SendTask[] = [];
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

      for (const payload of payloads) {
        for (const sub of userSubs) {
          tasks.push({
            subId: sub.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            payload,
          });
        }
      }
    }

    let sent = 0;
    let configErrorLogged = false;
    const expiredIds: string[] = [];
    const invalidIds: string[] = [];

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
        } else if (result.reason === "expired") {
          expiredIds.push(task.subId);
        } else if (result.reason === "invalid-endpoint" || result.reason === "invalid-key") {
          // Legacy/corrupt data — quarantine and delete
          invalidIds.push(task.subId);
        } else if (result.reason === "config" && !configErrorLogged) {
          Sentry.captureMessage("Web Push VAPID not configured — reminders cannot be sent", { level: "warning" });
          configErrorLogged = true;
        }
      }
    }

    // Clean up expired + invalid subscriptions
    const toDelete = [...expiredIds, ...invalidIds];
    if (toDelete.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    if (invalidIds.length > 0) {
      Sentry.captureMessage(`Cleaned ${invalidIds.length} legacy push subscriptions with non-allowlisted endpoints`, { level: "info" });
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "ok" });
    return NextResponse.json({ ok: true, sent, cleaned: toDelete.length });
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "send-reminders", status: "error" });
    Sentry.captureException(err, { tags: { endpoint: "cron-send-reminders" } });
    console.error("Send reminders cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
