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

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  if (!ensureVapid()) {
    // VAPID not configured — push is disabled, return early
    return false;
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
      { TTL: 14400 }, // 4 hours — adequate for morning reminders
    );
    return true;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    // 404 or 410 means subscription is no longer valid
    if (statusCode === 404 || statusCode === 410) {
      return false; // Caller should delete the subscription
    }
    console.error("Web Push error:", err);
    return false;
  }
}
