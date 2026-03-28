import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { captureMoodSnapshot } from "@/lib/journal/mood-snapshot";
import { detectCrisisContent } from "@/lib/journal/crisis-detection";

// ── Validation ──────────────────────────────────────────────────

const createSchema = z.object({
  type: z.enum(["DIARY", "QUICK_INSIGHT"]),
  content: z.string().min(1).max(5000),
  aiUseAllowed: z.boolean().optional().default(false),
  idempotencyKey: z.string().max(64).optional(),
});

// ── POST — Create journal entry ─────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 20 entries per hour (generous for mania bursts, with daily awareness)
  const allowed = await checkRateLimit(`journal:${session.userId}`, 20, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas entradas. Tente novamente mais tarde." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { type, content, aiUseAllowed, idempotencyKey } = parsed.data;

  // Enforce consent — server-side gate (cannot be bypassed by skipping UI)
  const consent = await prisma.consent.findFirst({
    where: { userId: session.userId, scope: "journal_data", revokedAt: null },
    select: { id: true },
  });
  if (!consent) {
    return NextResponse.json(
      { error: "Consentimento do diário não concedido. Acesse /meu-diario para autorizar." },
      { status: 403 },
    );
  }

  // Enforce type-specific limits
  if (type === "QUICK_INSIGHT" && content.length > 280) {
    return NextResponse.json(
      { error: "Insight rápido deve ter no máximo 280 caracteres." },
      { status: 400 },
    );
  }

  // Idempotency check (pre-check; race condition handled in catch)
  if (idempotencyKey) {
    const existing = await prisma.journalEntry.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ id: existing.id, deduplicated: true });
    }
  }

  try {
    // Capture mood snapshot (only if recent check-in exists)
    const snapshot = await captureMoodSnapshot(session.userId);

    // Compute local date
    const now = new Date();
    const entryDateLocal = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    // Create entry
    const entry = await prisma.journalEntry.create({
      data: {
        userId: session.userId,
        type,
        content,
        aiUseAllowed,
        idempotencyKey: idempotencyKey || undefined,
        entryDateLocal,
        capturedAt: now,
        ...snapshot,
      },
      select: {
        id: true,
        type: true,
        entryDateLocal: true,
        snapshotSource: true,
        zoneAtCapture: true,
        createdAt: true,
      },
    });

    // Crisis detection — never blocks saving, returns flag for UI
    const crisis = detectCrisisContent(content);

    return NextResponse.json({
      ...entry,
      crisisDetected: crisis.detected,
    });
  } catch (err) {
    // Handle idempotency race condition: two concurrent requests with same key
    // Prisma P2002 = unique constraint violation
    if (
      idempotencyKey &&
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.journalEntry.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ id: existing.id, deduplicated: true });
      }
    }
    // Do NOT log content (sensitive data)
    Sentry.captureException(err, { tags: { endpoint: "journal-create" } });
    console.error(JSON.stringify({ event: "journal_create_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: (err as Error).message?.slice(0, 200) || "Unknown" }));
    return NextResponse.json({ error: "Erro ao salvar entrada" }, { status: 500 });
  }
}

// ── GET — List journal entries (cursor pagination) ──────────────

const listSchema = z.object({
  type: z.enum(["DIARY", "QUICK_INSIGHT"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const readAllowed = await checkRateLimit(`journal_read:${session.userId}`, 60, 60_000);
  if (!readAllowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    type: url.searchParams.get("type") || undefined,
    cursor: url.searchParams.get("cursor") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const { type, cursor, limit } = parsed.data;

  const where: Record<string, unknown> = { userId: session.userId };
  if (type) where.type = type;

  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], // stable cursor pagination
    take: limit + 1, // extra for cursor
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // skip the cursor itself
        }
      : {}),
    select: {
      id: true,
      type: true,
      content: true,
      maniaScore: true,
      depressionScore: true,
      energyScore: true,
      zoneAtCapture: true,
      mixedAtCapture: true,
      snapshotSource: true,
      entryDateLocal: true,
      aiUseAllowed: true,
      editedAt: true,
      createdAt: true,
    },
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json(
    { items, nextCursor },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    },
  );
}
