import { NextRequest, NextResponse } from "next/server";

/**
 * WhatsApp Cloud API webhook.
 * - GET: Verification challenge (required by Meta)
 * - POST: Incoming messages (check-in via WhatsApp)
 *
 * Requires WHATSAPP_VERIFY_TOKEN env var.
 */

// Webhook verification (Meta sends GET with hub.challenge)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Incoming messages
export async function POST(request: NextRequest) {
  if (!process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();

    // WhatsApp sends nested structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) {
      // Status update or other non-message event
      return NextResponse.json({ ok: true });
    }

    for (const message of value.messages) {
      const from = message.from; // sender phone number
      const text = message.text?.body?.trim().toLowerCase();

      if (!text || !from) continue;

      // Simple keyword-based responses for pilot
      // TODO: Expand with proper NLU or structured menus
      console.log(`[WhatsApp] From: ${from}, Text: ${text}`);

      // For now, just acknowledge receipt
      // Full check-in flow will be implemented when Meta Business is set up
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Meta
  }
}
