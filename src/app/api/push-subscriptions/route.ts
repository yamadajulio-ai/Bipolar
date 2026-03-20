import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { isAllowedPushEndpoint } from "@/lib/push-constants";

const MAX_SUBSCRIPTIONS_PER_USER = 5;

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048).refine(
    isAllowedPushEndpoint,
    "Push endpoint must be a known push service (FCM, Mozilla, Apple, WNS)",
  ),
  keys: z.object({
    // p256dh: base64url-encoded P-256 public key (65 bytes raw = 87-88 chars base64url)
    p256dh: z.string().min(80).max(100).regex(/^[A-Za-z0-9_-]+={0,2}$/),
    // auth: base64url-encoded auth secret (16 bytes raw = 22-24 chars base64url)
    auth: z.string().min(20).max(30).regex(/^[A-Za-z0-9_-]+={0,2}$/),
  }),
});

// POST — Subscribe (save push subscription)
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: 10 subscription changes per 15 minutes per user
  const allowed = await checkRateLimit(`push_sub:${session.userId}`, 10);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente mais tarde." },
      { status: 429 }
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // All checks + mutations in a single interactive transaction
    // to prevent race conditions on both cap enforcement and endpoint ownership.
    await prisma.$transaction(async (tx) => {
      // Cap check inside transaction for atomicity
      const existingCount = await tx.pushSubscription.count({
        where: { userId: session.userId },
      });
      const isUpdate = await tx.pushSubscription.findUnique({
        where: {
          userId_endpoint: {
            userId: session.userId,
            endpoint: parsed.data.endpoint,
          },
        },
        select: { id: true },
      });

      if (!isUpdate && existingCount >= MAX_SUBSCRIPTIONS_PER_USER) {
        throw new Error("CAP_EXCEEDED");
      }

      // Shared device safety: remove this endpoint from ANY other user first.
      await tx.pushSubscription.deleteMany({
        where: {
          endpoint: parsed.data.endpoint,
          userId: { not: session.userId },
        },
      });

      // Upsert for current user
      await tx.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId: session.userId,
            endpoint: parsed.data.endpoint,
          },
        },
        update: {
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
        },
        create: {
          userId: session.userId,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.keys.p256dh,
          auth: parsed.data.keys.auth,
        },
        select: { id: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "CAP_EXCEEDED") {
      return NextResponse.json(
        { error: "Limite de dispositivos atingido. Remova um dispositivo antes de adicionar outro." },
        { status: 409 },
      );
    }
    Sentry.captureException(err, { tags: { endpoint: "push-subscribe" } });
    console.error(JSON.stringify({
      event: "push_subscribe_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: err instanceof Error ? err.message.slice(0, 100) : "Unknown error",
    }));
    return NextResponse.json({ error: "Erro ao salvar inscrição" }, { status: 500 });
  }
}

// DELETE — Unsubscribe (remove push subscription)
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Rate limit: share same bucket as POST (subscription changes)
  const allowed = await checkRateLimit(`push_sub:${session.userId}`, 10);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas requisições. Tente novamente mais tarde." },
      { status: 429 }
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const endpoint = body.endpoint;

    if (!endpoint || typeof endpoint !== "string" || endpoint.length > 2048) {
      return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
    }

    // Validate URL format and push service allowlist (matches POST validation)
    if (!isAllowedPushEndpoint(endpoint)) {
      return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId: session.userId,
        endpoint,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "push-unsubscribe" } });
    console.error(JSON.stringify({
      event: "push_unsubscribe_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: err instanceof Error ? err.message.slice(0, 100) : "Unknown error",
    }));
    return NextResponse.json({ error: "Erro ao remover inscrição" }, { status: 500 });
  }
}
