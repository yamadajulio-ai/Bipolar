import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { sendMetaEvent } from "@/lib/meta-capi";
import { getClientIp, checkRateLimit, maskIp } from "@/lib/security";

/** Whitelist de eventos padrão da Meta — nunca aceitar nomes arbitrários */
const ALLOWED_EVENTS = new Set([
  "PageView",
  "ViewContent",
  "CompleteRegistration",
  "Lead",
]);

/** Whitelist de campos permitidos em customData — evitar vazamento de dados sensíveis */
const ALLOWED_CUSTOM_FIELDS = new Set([
  "content_name",
  "content_category",
  "currency",
  "value",
]);

/** Valida que a URL pertence ao nosso domínio */
function isValidSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "suportebipolar.com" ||
      parsed.hostname === "www.suportebipolar.com" ||
      parsed.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/meta-events
 * Recebe eventos do browser e envia server-side via Conversions API.
 * O browser envia o mesmo event_id que usou no fbq() para deduplicação.
 *
 * Segurança:
 * - CSRF: protegido pelo middleware (same-origin only)
 * - Event names: whitelist de eventos padrão
 * - Source URL: validada contra domínio próprio
 * - Custom data: whitelist de campos permitidos
 */
export async function POST(request: NextRequest) {
  // Rate limit: 30 events per minute per IP
  const rawIp = getClientIp(request);
  const rlAllowed = await checkRateLimit(`meta-events:${rawIp}`, 30, 60_000);
  if (!rlAllowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { eventName, eventId, sourceUrl, customData } = body;

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Missing eventName or eventId" }, { status: 400 });
    }

    // Validar event name contra whitelist
    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ error: "Invalid event name" }, { status: 400 });
    }

    // Validar event_id format (timestamp-random)
    if (typeof eventId !== "string" || eventId.length > 64) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    // Validar e sanitizar source URL
    const safeSourceUrl =
      sourceUrl && isValidSourceUrl(sourceUrl)
        ? sourceUrl
        : request.headers.get("referer") || "https://suportebipolar.com";

    // Sanitizar customData — aceitar apenas campos permitidos com valores string
    let safeCustomData: Record<string, string> | undefined;
    if (customData && typeof customData === "object") {
      safeCustomData = {};
      for (const [key, val] of Object.entries(customData)) {
        if (ALLOWED_CUSTOM_FIELDS.has(key) && typeof val === "string" && val.length <= 100) {
          safeCustomData[key] = val;
        }
      }
      if (Object.keys(safeCustomData).length === 0) {
        safeCustomData = undefined;
      }
    }

    // Mask IP before sending to Meta — minimize PII exposure (LGPD)
    const ipAddress = rawIp === "unknown" ? undefined : (maskIp(rawIp) ?? undefined);
    const userAgent = request.headers.get("user-agent") || undefined;

    // Cookies do Meta Pixel (_fbc, _fbp)
    const fbc = request.cookies.get("_fbc")?.value;
    const fbp = request.cookies.get("_fbp")?.value;

    await sendMetaEvent({
      eventName,
      eventId,
      sourceUrl: safeSourceUrl,
      ipAddress,
      userAgent,
      fbc,
      fbp,
      customData: safeCustomData,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "meta-events" } });
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
