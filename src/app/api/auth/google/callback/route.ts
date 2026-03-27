import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google/auth";
import { encrypt } from "@/lib/crypto";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/integracoes?error=no_code", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/integracoes?error=no_token", request.url));
    }

    await prisma.googleAccount.upsert({
      where: { userId: session.userId },
      update: {
        accessToken: encrypt(tokens.access_token),
        ...(tokens.refresh_token ? { refreshToken: encrypt(tokens.refresh_token) } : {}),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      },
      create: {
        userId: session.userId,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token || ""),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      },
    });

    return NextResponse.redirect(new URL("/integracoes?google=connected", request.url));
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "google-auth-callback" } });
    console.error(JSON.stringify({ event: "google_auth_callback_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: (err as Error).message?.slice(0, 200) || "Unknown" }));
    return NextResponse.redirect(new URL("/integracoes?error=google_auth_failed", request.url));
  }
}
