import webPush from "web-push";
import * as Sentry from "@sentry/nextjs";
import { isAllowedPushEndpoint } from "@/lib/push-constants";

let vapidConfigured = false;

/**
 * Lazily configure VAPID credentials at runtime.
 * Returns false if env vars are missing (push disabled).
 */
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@suportebipolar.com";
  if (!pub || !priv) return false;
  webPush.setVapidDetails(subject, pub, priv);
  vapidConfigured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "transient" | "config" | "invalid-endpoint" };

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureVapid()) {
    Sentry.captureMessage("Web Push: VAPID not configured — reminders disabled", { level: "warning" });
    return { ok: false, reason: "config" };
  }
  // Full allowlist check at send-time — guards against legacy/migrated DB rows
  // that bypassed the write-time validation in push-subscriptions route.
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return { ok: false, reason: "invalid-endpoint" };
  }
  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 1800 }, // 30 minutes — avoid stale reminders arriving hours late
    );
    return { ok: true };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 404 or 410 means subscription is no longer valid
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, reason: "expired" };
    }
    // 400/403 = possibly VAPID config issue, not necessarily dead subscription.
    // Treat as transient to avoid deleting valid subscriptions on our config errors.
    if (statusCode === 400 || statusCode === 403) {
      Sentry.captureMessage(`Web Push ${statusCode} error — possible VAPID/config issue`, {
        level: "warning",
        tags: { feature: "web-push", statusCode: String(statusCode) },
      });
      return { ok: false, reason: "transient" };
    }
    console.error("Web Push error:", err);
    return { ok: false, reason: "transient" };
  }
}
