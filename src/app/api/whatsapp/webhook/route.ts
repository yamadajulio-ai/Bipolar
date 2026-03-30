import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { maskIp } from "@/lib/security";

// ── Zod schemas for Meta WhatsApp Cloud API webhook payload ─────
const whatsappTextSchema = z.object({ body: z.string().max(4096) });

const whatsappDocumentSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  filename: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
});

const whatsappMessageSchema = z.object({
  id: z.string().optional(),
  from: z.string().optional(),
  text: whatsappTextSchema.optional(),
  document: whatsappDocumentSchema.optional(),
  type: z.string().optional(),
});

const whatsappValueSchema = z.object({
  messages: z.array(whatsappMessageSchema).optional(),
  statuses: z.unknown().optional(),
  metadata: z.unknown().optional(),
  messaging_product: z.string().optional(),
});

const whatsappChangeSchema = z.object({
  value: whatsappValueSchema,
  field: z.string().optional(),
});

const whatsappEntrySchema = z.object({
  id: z.string().optional(),
  changes: z.array(whatsappChangeSchema).optional(),
});

const whatsappWebhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(whatsappEntrySchema).optional(),
});

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

// ── Download media from Meta CDN ──────────────────────────────

async function downloadMetaMedia(mediaId: string): Promise<ArrayBuffer | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;

  try {
    // Step 1: Get download URL
    const urlRes = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!urlRes.ok) return null;

    const urlData = await urlRes.json();
    const downloadUrl = urlData.url;
    if (!downloadUrl) return null;

    // Validate URL is a Meta CDN domain (prevent SSRF)
    const parsedUrl = new URL(downloadUrl);
    const allowedHosts = [".fbcdn.net", ".whatsapp.net", ".facebook.com", ".facebookserver.com"];
    if (!allowedHosts.some((h) => parsedUrl.hostname.endsWith(h))) {
      return null; // Reject non-Meta URLs
    }

    // Step 2: Download file content
    const fileRes = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileRes.ok) return null;

    // Enforce 10MB limit
    const contentLength = fileRes.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
      return null;
    }

    const buffer = await fileRes.arrayBuffer();
    if (buffer.byteLength > 10 * 1024 * 1024) return null;

    return buffer;
  } catch {
    return null;
  }
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
    // Validate webhook payload structure with Zod
    const parsed = whatsappWebhookSchema.safeParse(body);
    if (!parsed.success) {
      Sentry.captureMessage("WhatsApp webhook: invalid payload structure", {
        level: "warning",
        tags: { endpoint: "whatsapp-webhook", event: "schema_rejected" },
        extra: { issues: parsed.error.issues.slice(0, 5) },
      });
      // Ack to prevent Meta retries (payload is permanently invalid)
      return NextResponse.json({ ok: true });
    }

    const entries = parsed.data.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        const messages = change.value.messages;
        if (!messages) continue;

        for (const message of messages) {
          const messageId = message.id;
          const from = message.from;
          const text = message.text?.body;

          if (!text || !from) continue;

          // Breadcrumb only — no phone data in logs (even masked, PHI risk)
          Sentry.addBreadcrumb({
            category: "whatsapp",
            message: "Message received",
            level: "info",
          });

          // ── In-band opt-out (WhatsApp policy requirement) ──────────
          // Users must be able to stop messages by replying within WhatsApp.
          // Handles: PARAR, SAIR, STOP, CANCELAR (case-insensitive, trimmed)
          //
          // NOTE: In-band opt-IN (ATIVAR/START) is NOT supported here.
          // LGPD art. 11 requires specific, highlighted, informed consent for
          // sensitive health data — a bare keyword in WhatsApp does not meet
          // that standard. Opt-in must happen in the authenticated app UI.
          const normalizedText = text.trim().toUpperCase();
          const OPT_OUT_KEYWORDS = new Set(["PARAR", "SAIR", "STOP", "CANCELAR"]);

          if (OPT_OUT_KEYWORDS.has(normalizedText)) {
            // Atomic: dedupe marker + opt-out in a single interactive transaction.
            // If any step fails, nothing is committed — Meta retries safely.
            const user = await prisma.user.findFirst({
              where: { whatsappPhone: `+${from}` },
              select: { id: true },
            });

            try {
              await prisma.$transaction(async (tx) => {
                // Dedupe marker inside transaction — if already processed, P2002 aborts all
                if (messageId) {
                  await tx.processedWhatsAppMessage.create({
                    data: { messageId },
                  });
                }
                if (user) {
                  await tx.consent.updateMany({
                    where: { userId: user.id, scope: "whatsapp", revokedAt: null },
                    data: { revokedAt: new Date() },
                  });
                  await tx.communicationPreference.updateMany({
                    where: { userId: user.id },
                    data: { whatsapp: false },
                  });
                }
              });
            } catch (err) {
              // P2002 = already processed (dedupe) → skip silently
              if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
                continue;
              }
              throw err;
            }

            if (user) {
              Sentry.addBreadcrumb({
                category: "whatsapp",
                message: "Opt-out processed via keyword",
                level: "info",
              });
            }
            continue;
          }

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

          // ── Document messages (financial file import) ────────────
          if (message.type === "document" && message.document) {
            const doc = message.document;
            // Sanitize filename against path traversal
            const filename = (doc.filename || "unknown").split(/[/\\]/).pop() || "unknown";
            const ext = filename.toLowerCase().split(".").pop() || "";
            const SUPPORTED_EXTENSIONS = new Set(["csv", "xlsx", "ofx", "qfx"]);

            if (SUPPORTED_EXTENSIONS.has(ext)) {
              // Find user by WhatsApp phone
              const importUser = await prisma.user.findFirst({
                where: { whatsappPhone: `+${from}` },
                select: { id: true },
              });

              if (importUser) {
                try {
                  // Download document from Meta CDN
                  const fileContent = await downloadMetaMedia(doc.id);
                  if (fileContent) {
                    // Dynamic import to avoid circular deps
                    const { ingestFinancialFile } = await import("@/lib/financeiro/ingest");
                    const { hasConsent } = await import("@/lib/consent");

                    // Check consent
                    const consent = await hasConsent(importUser.id, "health_data");
                    if (consent) {
                      const result = await ingestFinancialFile(
                        fileContent,
                        filename,
                        {
                          userId: importUser.id,
                          channel: "whatsapp",
                          fileName: filename,
                          fileSize: (fileContent as ArrayBuffer).byteLength,
                        },
                      );

                      Sentry.addBreadcrumb({
                        category: "whatsapp",
                        message: "Financial document imported",
                        level: "info",
                        data: { imported: result.imported, source: result.source },
                      });

                      // Send confirmation (separate try/catch — import already succeeded)
                      try {
                        const { sendWhatsAppText } = await import("@/lib/whatsapp");
                        await sendWhatsAppText({
                          to: from,
                          text: `Importação concluída!\n\n${result.imported} transações importadas${result.skipped > 0 ? `\n${result.skipped} duplicatas ignoradas` : ""}\n\nVeja seus dados em: ${process.env.NEXT_PUBLIC_APP_URL || "https://suportebipolar.com"}/financeiro`,
                        });
                      } catch { /* confirmation failed but import succeeded — silent */ }
                    } else {
                      // No consent — notify user
                      try {
                        const { sendWhatsAppText } = await import("@/lib/whatsapp");
                        await sendWhatsAppText({
                          to: from,
                          text: "Para importar dados financeiros, é necessário ativar o consentimento de dados de saúde no app.",
                        });
                      } catch { /* silent */ }
                    }
                  } else {
                    // Download failed — notify user
                    try {
                      const { sendWhatsAppText } = await import("@/lib/whatsapp");
                      await sendWhatsAppText({
                        to: from,
                        text: "Não foi possível baixar o arquivo. Tente enviar novamente.",
                      });
                    } catch { /* silent */ }
                  }
                } catch (err) {
                  Sentry.captureException(err, {
                    tags: { endpoint: "whatsapp-webhook", event: "document_import_error" },
                  });
                  // Send error message to user
                  try {
                    const { sendWhatsAppText } = await import("@/lib/whatsapp");
                    const msg = err instanceof Error && err.name === "IngestError"
                      ? err.message
                      : "Erro ao processar o arquivo. Verifique o formato e tente novamente.";
                    await sendWhatsAppText({ to: from, text: msg });
                  } catch { /* silent */ }
                }
              }
            }
            continue;
          }

          // Other messages — placeholder for future NLU/structured menus
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
