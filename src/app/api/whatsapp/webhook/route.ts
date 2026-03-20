import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";

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
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

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

  // Reject oversized payloads (max 256KB — Meta payloads are typically <10KB)
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  // Double-check actual body size in bytes (not chars — multibyte UTF-8 matters)
  if (Buffer.byteLength(rawBody, "utf8") > 256 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  // Validate X-Hub-Signature-256 before processing
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Malformed JSON — ack to prevent Meta retries, but log as dead-letter
    // so we don't silently lose messages. No PHI in the log — just the event.
    Sentry.captureMessage("WhatsApp webhook: malformed JSON (dead-letter)", {
      level: "warning",
      tags: { endpoint: "whatsapp-webhook", event: "dead_letter" },
      extra: { bodyLength: rawBody.length },
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // WhatsApp may send multiple entries/changes — process all of them
    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray((entry as Record<string, unknown>).changes) ? (entry as Record<string, unknown>).changes as unknown[] : [];
      for (const change of changes) {
        const value = (change as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
        if (!value?.messages) continue;

        for (const message of value.messages as Array<Record<string, unknown>>) {
          const messageId = message.id as string | undefined;
          const from = message.from as string | undefined;
          const text = (message.text as Record<string, unknown>)?.body;

          if (!text || !from) continue;

          // Durable idempotency: dedupe by message.id via persistent ledger.
          // Survives restarts, replays, and late retries from Meta.
          if (messageId) {
            try {
              await prisma.processedWhatsAppMessage.create({
                data: { messageId },
              });
            } catch (err) {
              // Unique constraint violation = already processed → skip
              if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
                continue;
              }
              throw err; // Unexpected error — let outer catch handle it
            }
          }

          // Breadcrumb only — no phone data in logs (even masked, PHI risk)
          Sentry.addBreadcrumb({
            category: "whatsapp",
            message: "Message received",
            level: "info",
          });

          // Simple keyword-based responses for pilot
          // TODO: Expand with proper NLU or structured menus
          // Full check-in flow will be implemented when Meta Business is set up
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Processing error — return 500 so Meta retries (they have exponential backoff).
    // The raw body was already parsed + signature validated, so retry is safe.
    Sentry.captureException(err, {
      level: "error",
      tags: { endpoint: "whatsapp-webhook" },
    });
    console.error(JSON.stringify({
      event: "whatsapp_webhook_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: err instanceof Error ? err.message.slice(0, 100) : "Unknown error",
    }));
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
