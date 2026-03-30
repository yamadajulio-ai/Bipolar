import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { hasConsent } from "@/lib/consent";
import { ingestFinancialFile, IngestError } from "@/lib/financeiro/ingest";

/**
 * Postmark Inbound Email Webhook for financial file imports.
 *
 * Users send CSV/XLSX/OFX attachments to their unique import address:
 *   importar+{userId}.{hmac8}@suportebipolar.com
 *
 * The MailboxHash (part after +) contains the userId and an HMAC
 * signature for stateless authentication.
 *
 * Postmark delivers the email as JSON POST with attachments in base64.
 *
 * Setup:
 * 1. Configure inbound domain in Postmark (importar@suportebipolar.com or subdomain)
 * 2. Set webhook URL: https://suportebipolar.com/api/financeiro/inbound-email
 * 3. This route handles the rest
 */

const ALLOWED_EXTENSIONS = new Set([".csv", ".xlsx", ".ofx", ".qfx"]);
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

interface PostmarkAttachment {
  Name: string;
  Content: string; // base64
  ContentType: string;
  ContentLength: number;
}

interface PostmarkInboundPayload {
  From: string;
  To: string;
  Subject: string;
  MailboxHash: string; // part after + in address
  Attachments: PostmarkAttachment[];
  MessageID: string;
}

export async function POST(request: NextRequest) {
  // Verify request comes from Postmark (basic auth or IP check)
  // Postmark sends from known IPs — for extra security, check a shared secret header
  const authHeader = request.headers.get("x-postmark-inbound-token");
  const expectedToken = process.env.POSTMARK_INBOUND_TOKEN;

  // Fail-closed: if token not configured, reject all requests
  if (!expectedToken) {
    Sentry.captureMessage("Inbound email: POSTMARK_INBOUND_TOKEN not configured", { level: "error" });
    return NextResponse.json({ error: "Não configurado" }, { status: 503 });
  }

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let payload: PostmarkInboundPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { MailboxHash, Attachments, MessageID } = payload;

  if (!MailboxHash) {
    Sentry.addBreadcrumb({
      category: "inbound-email",
      message: "No MailboxHash — cannot identify user",
      level: "warning",
    });
    return NextResponse.json({ ok: true }); // ACK to prevent retries
  }

  // ── Authenticate user via HMAC-signed token ───────────────────
  const resolved = resolveMailboxHash(MailboxHash);
  if (!resolved) {
    Sentry.captureMessage("Inbound email: invalid HMAC token", {
      level: "warning",
      tags: { endpoint: "inbound-email" },
    });
    return NextResponse.json({ ok: true }); // ACK
  }

  const { userId } = resolved;

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true }); // ACK — user deleted
  }

  // Consent check
  const consent = await hasConsent(userId, "health_data");
  if (!consent) {
    Sentry.addBreadcrumb({
      category: "inbound-email",
      message: "Skipped import — no health_data consent",
      level: "info",
    });
    return NextResponse.json({ ok: true }); // ACK — no consent
  }

  // ── Process attachments ───────────────────────────────────────
  if (!Attachments || Attachments.length === 0) {
    return NextResponse.json({ ok: true, message: "No attachments" });
  }

  // Limit attachments to prevent resource exhaustion
  const MAX_ATTACHMENTS = 5;
  const attachmentsToProcess = Attachments.slice(0, MAX_ATTACHMENTS);

  const results: Array<{ file: string; imported: number; skipped: number; error?: string }> = [];

  for (const attachment of attachmentsToProcess) {
    const ext = getExtension(attachment.Name);
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    if (attachment.ContentLength > MAX_ATTACHMENT_SIZE) {
      results.push({ file: attachment.Name, imported: 0, skipped: 0, error: "Arquivo muito grande" });
      continue;
    }

    try {
      // Decode base64 attachment
      const buffer = Buffer.from(attachment.Content, "base64");

      // Verify actual decoded size (don't trust ContentLength from payload)
      if (buffer.length > MAX_ATTACHMENT_SIZE) {
        results.push({ file: attachment.Name, imported: 0, skipped: 0, error: "Arquivo muito grande" });
        continue;
      }

      let content: string | ArrayBuffer;
      if (ext === ".xlsx") {
        content = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      } else {
        content = buffer.toString("utf-8");
      }

      const result = await ingestFinancialFile(content, attachment.Name, {
        userId,
        channel: "email",
        fileName: attachment.Name,
        fileSize: attachment.ContentLength,
      });

      results.push({
        file: attachment.Name,
        imported: result.imported,
        skipped: result.skipped,
      });
    } catch (err) {
      const msg = err instanceof IngestError ? err.message : "Erro ao processar";
      results.push({ file: attachment.Name, imported: 0, skipped: 0, error: msg });
    }
  }

  Sentry.addBreadcrumb({
    category: "inbound-email",
    message: `Processed ${results.length} attachments`,
    level: "info",
    data: { messageId: MessageID, filesProcessed: results.length },
  });

  return NextResponse.json({ ok: true, results });
}

// ── HMAC token utilities ────────────────────────────────────────

/**
 * Generate the import email address for a user.
 * Format: importar+{userId}.{hmac8}@suportebipolar.com
 */
/**
 * Generate the import email address for a user.
 *
 * If POSTMARK_INBOUND_DOMAIN is set (requires MX record pointing to
 * inbound.postmarkapp.com), uses: importar+{hash}@{domain}
 *
 * Otherwise, uses Postmark's default inbound address with the hash
 * in the MailboxHash position.
 */
export function generateImportEmail(userId: string): string {
  const token = generateMailboxHash(userId);
  const customDomain = process.env.POSTMARK_INBOUND_DOMAIN;

  if (customDomain) {
    return `importar+${token}@${customDomain}`;
  }

  // Fallback: Postmark's default inbound address
  // Format: {hash}@{postmark-inbound-hash}.inbound.postmarkapp.com
  const postmarkHash = process.env.POSTMARK_INBOUND_HASH || "8b9fe20b5fc30d649ba7e638318ddb6d";
  return `${token}@${postmarkHash}.inbound.postmarkapp.com`;
}

function generateMailboxHash(userId: string): string {
  const secret = process.env.SESSION_SECRET || "";
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`financial-import:${userId}`)
    .digest("hex")
    .slice(0, 16);
  return `${userId}.${hmac}`;
}

function resolveMailboxHash(hash: string): { userId: string } | null {
  const dotIdx = hash.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const userId = hash.slice(0, dotIdx);
  const providedHmac = hash.slice(dotIdx + 1);

  const secret = process.env.SESSION_SECRET || "";
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(`financial-import:${userId}`)
    .digest("hex")
    .slice(0, 16);

  // Timing-safe comparison
  if (providedHmac.length !== expectedHmac.length) return null;
  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (!crypto.timingSafeEqual(a, b)) return null;

  return { userId };
}

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}
