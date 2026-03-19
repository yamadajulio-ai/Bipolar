import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const MAX_SUBSCRIPTIONS_PER_USER = 5;

/**
 * Allowlist of known Web Push service hosts.
 * Push endpoints should only point to browser vendor push gateways.
 * This prevents SSRF via crafted subscription objects.
 */
const PUSH_SERVICE_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "wns.windows.com",
  "notify.windows.com",
  "push.api.chrome.google.com",
];

function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return PUSH_SERVICE_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith("." + host),
    );
  } catch {
    return false;
  }
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048).refine(
    isAllowedPushEndpoint,
    "Push endpoint must be a known push service (FCM, Mozilla, Apple, WNS)",
  ),
  keys: z.object({
    // p256dh: base64url-encoded P-256 public key (65 bytes raw = 88 chars base64)
    p256dh: z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+={0,2}$/),
    // auth: base64url-encoded auth secret (16 bytes raw = 24 chars base64)
    auth: z.string().min(10).max(50).regex(/^[A-Za-z0-9_-]+={0,2}$/),
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
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Cap subscriptions per user to prevent abuse
    const existingCount = await prisma.pushSubscription.count({
      where: { userId: session.userId },
    });
    const isUpdate = await prisma.pushSubscription.findUnique({
      where: {
        userId_endpoint: {
          userId: session.userId,
          endpoint: parsed.data.endpoint,
        },
      },
      select: { id: true },
    });

    if (!isUpdate && existingCount >= MAX_SUBSCRIPTIONS_PER_USER) {
      return NextResponse.json(
        { error: "Limite de dispositivos atingido. Remova um dispositivo antes de adicionar outro." },
        { status: 409 },
      );
    }

    // Atomic: remove endpoint from other users + upsert for current user.
    // Transaction ensures no race where two users claim the same endpoint.
    await prisma.$transaction([
      // Shared device safety: remove this endpoint from ANY other user first.
      prisma.pushSubscription.deleteMany({
        where: {
          endpoint: parsed.data.endpoint,
          userId: { not: session.userId },
        },
      }),
      // Upsert for current user
      prisma.pushSubscription.upsert({
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
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "push-subscribe" } });
    console.error("Push subscription error:", err);
    return NextResponse.json({ error: "Erro ao salvar inscrição" }, { status: 500 });
  }
}

// DELETE — Unsubscribe (remove push subscription)
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const endpoint = body.endpoint;

    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "Endpoint obrigatório" }, { status: 400 });
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
    console.error("Push unsubscribe error:", err);
    return NextResponse.json({ error: "Erro ao remover inscrição" }, { status: 500 });
  }
}
