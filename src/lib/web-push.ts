import webPush from "web-push";

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
  | { ok: false; reason: "expired" | "transient" | "config" };

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureVapid()) {
    return { ok: false, reason: "config" };
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
    console.error("Web Push error:", err);
    return { ok: false, reason: "transient" };
  }
}
