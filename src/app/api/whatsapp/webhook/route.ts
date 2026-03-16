import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * WhatsApp Cloud API webhook.
 * - GET: Verification challenge (required by Meta)
 * - POST: Incoming messages (check-in via WhatsApp)
 *
 * Requires env vars:
 * - WHATSAPP_VERIFY_TOKEN: webhook verification token (you choose)
 * - WHATSAPP_APP_SECRET: Meta App Secret for X-Hub-Signature-256 validation
 */

// ── HMAC signature verification (Meta X-Hub-Signature-256) ──────

function verifyMetaSignature(
  rawBody: string,
  signature: string | null,
  appSecret: string,
): boolean {
  if (!signature?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Webhook verification (Meta sends GET with hub.challenge) ────

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

// ── Incoming messages ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !process.env.WHATSAPP_VERIFY_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Validate X-Hub-Signature-256 before processing
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);

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

      // Log masked phone only (last 4 digits) — never full number
      const maskedPhone = from.length > 4
        ? "*".repeat(from.length - 4) + from.slice(-4)
        : "****";
      console.log(`[WhatsApp] Message received from ${maskedPhone}`);

      // Simple keyword-based responses for pilot
      // TODO: Expand with proper NLU or structured menus
      // Full check-in flow will be implemented when Meta Business is set up
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WhatsApp webhook error:", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ ok: true }); // Always return 200 to Meta
  }
}
