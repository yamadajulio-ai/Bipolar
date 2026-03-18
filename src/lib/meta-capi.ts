/**
 * Meta Conversions API (CAPI) — Server-side event tracking.
 *
 * Envia eventos server-side para a Meta, complementando o Pixel do browser.
 * Ambos usam o mesmo event_id para deduplicação automática.
 *
 * Env vars necessárias:
 * - META_PIXEL_ID (server-only, mesmo valor do NEXT_PUBLIC_META_PIXEL_ID)
 * - META_CAPI_ACCESS_TOKEN (gerado no Events Manager → Settings → Generate Access Token)
 */

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const API_VERSION = "v22.0";

interface UserData {
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string; // _fbc cookie
  fbp?: string; // _fbp cookie
}

interface CustomData {
  content_name?: string;
  content_category?: string;
  currency?: string;
  value?: number;
}

interface ServerEvent {
  event_name: string;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: UserData;
  custom_data?: CustomData;
}

/**
 * Envia evento server-side para a Meta Conversions API.
 * Silencia erros para não impactar a experiência do usuário.
 */
export async function sendMetaEvent(params: {
  eventName: string;
  eventId: string;
  sourceUrl: string;
  ipAddress?: string;
  userAgent?: string;
  fbc?: string;
  fbp?: string;
  customData?: CustomData;
}): Promise<void> {
  if (!PIXEL_ID || !ACCESS_TOKEN) return;

  const event: ServerEvent = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    event_source_url: params.sourceUrl,
    action_source: "website",
    user_data: {
      client_ip_address: params.ipAddress,
      client_user_agent: params.userAgent,
      fbc: params.fbc,
      fbp: params.fbp,
    },
    custom_data: params.customData,
  };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [event],
        access_token: ACCESS_TOKEN,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[Meta CAPI] Error:", res.status, body);
    }
  } catch (err) {
    console.error("[Meta CAPI] Network error:", err);
  }
}
