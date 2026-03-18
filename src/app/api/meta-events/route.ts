import { NextRequest, NextResponse } from "next/server";
import { sendMetaEvent } from "@/lib/meta-capi";

/**
 * POST /api/meta-events
 * Recebe eventos do browser e envia server-side via Conversions API.
 * O browser envia o mesmo event_id que usou no fbq() para deduplicação.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventName, eventId, sourceUrl, customData } = body;

    if (!eventName || !eventId) {
      return NextResponse.json({ error: "Missing eventName or eventId" }, { status: 400 });
    }

    // Extrair dados do request para user_data
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    // Cookies do Meta Pixel (_fbc, _fbp)
    const fbc = request.cookies.get("_fbc")?.value;
    const fbp = request.cookies.get("_fbp")?.value;

    await sendMetaEvent({
      eventName,
      eventId,
      sourceUrl: sourceUrl || request.headers.get("referer") || "https://suportebipolar.com",
      ipAddress,
      userAgent,
      fbc,
      fbp,
      customData,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
