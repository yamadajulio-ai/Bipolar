import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";

export const maxDuration = 60;
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import {
  isPluggyConfigured,
  fetchTransactions,
  mapPluggyTransactions,
} from "@/lib/financeiro/pluggy";
import { ingestPluggyTransactions } from "@/lib/financeiro/ingest";

// ── Zod schema for Pluggy webhook payload ────────────────────────

const pluggyWebhookSchema = z.object({
  event: z.string(),
  data: z.object({
    id: z.string().optional(),
    itemId: z.string().optional(),
    clientUserId: z.string().optional(),
    error: z.unknown().optional(),
  }),
});

/**
 * POST /api/financeiro/pluggy/webhook
 *
 * Receives webhook events from Pluggy when bank data is synced.
 *
 * Event types:
 * - item/created: new bank connection established
 * - item/updated: data refreshed (transactions available)
 * - item/error: connection error
 *
 * Security: Pluggy sends an event with the item ID.
 * We verify the item belongs to a known user via clientUserId.
 */
export async function POST(request: NextRequest) {
  if (!isPluggyConfigured()) {
    return NextResponse.json({ ok: true }); // ACK — not configured
  }

  // Reject oversized payloads
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
    return NextResponse.json({ ok: true }); // ACK — too large
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // ACK — malformed JSON
  }

  // Validate payload with Zod
  const parsed = pluggyWebhookSchema.safeParse(body);
  if (!parsed.success) {
    Sentry.captureMessage("Pluggy webhook: invalid payload structure", {
      level: "warning",
      tags: { endpoint: "pluggy_webhook" },
      extra: { issues: parsed.error.issues.slice(0, 5) },
    });
    return NextResponse.json({ ok: true }); // ACK — permanently invalid
  }

  const { event, data } = parsed.data;
  const itemId = data.itemId || data.id;
  const clientUserId = data.clientUserId;

  if (!itemId) {
    return NextResponse.json({ ok: true }); // ACK — no item ID
  }

  Sentry.addBreadcrumb({
    category: "pluggy",
    message: `Webhook: ${event}`,
    level: "info",
    data: { itemId },
  });

  // Only process item updates (when fresh transactions are available)
  if (event !== "item/updated" && event !== "item/created") {
    if (event === "item/error") {
      Sentry.captureMessage("Pluggy item error", {
        level: "warning",
        tags: { endpoint: "pluggy_webhook" },
        extra: { itemId, error: data.error },
      });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Idempotency guard ──────────────────────────────────────────
  // Prevent duplicate processing when Pluggy retries or fires multiple webhooks
  const recentImport = await prisma.financialImportEvent.findFirst({
    where: {
      channel: "pluggy",
      status: "imported",
      metadata: { contains: itemId },
      createdAt: { gte: new Date(Date.now() - 60_000) }, // within last 60s
    },
    select: { id: true },
  });
  if (recentImport) {
    return NextResponse.json({ ok: true }); // Already processed recently
  }

  // Resolve user from clientUserId (which we set to our userId)
  if (!clientUserId) {
    Sentry.captureMessage("Pluggy webhook: no clientUserId", {
      level: "warning",
      tags: { endpoint: "pluggy_webhook" },
      extra: { itemId },
    });
    return NextResponse.json({ ok: true });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  // Consent gate — verify user still consents to financial data processing
  const { hasConsent } = await import("@/lib/consent");
  const consent = await hasConsent(clientUserId, "health_data");
  if (!consent) {
    Sentry.addBreadcrumb({
      category: "pluggy",
      message: "Skipped — user revoked consent",
      level: "info",
    });
    return NextResponse.json({ ok: true });
  }

  try {
    // Fetch transactions from Pluggy API
    const rawTransactions = await fetchTransactions(itemId, {
      // Fetch last 90 days
      from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    });

    if (rawTransactions.length === 0) {
      return NextResponse.json({ ok: true, imported: 0 });
    }

    // Map to our format and ingest
    const mapped = mapPluggyTransactions(rawTransactions);
    const result = await ingestPluggyTransactions(clientUserId, mapped, itemId);

    Sentry.addBreadcrumb({
      category: "pluggy",
      message: `Imported ${result.imported} transactions`,
      level: "info",
      data: { itemId, imported: result.imported, skipped: result.skipped },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { endpoint: "pluggy_webhook" },
      extra: { itemId, userId: clientUserId },
    });
    // Return 200 to ACK — Pluggy would retry on 5xx and we'd re-fail
    return NextResponse.json({ ok: true, error: "processing_failed" });
  }
}
