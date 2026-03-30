import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google/auth";
import { encrypt } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/security";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowed = await checkRateLimit(`google_callback:${session.userId}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.redirect(new URL("/integracoes?error=rate_limited", request.url));
  }

  // Validate state parameter (CSRF protection)
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google-link-state")?.value;
  cookieStore.delete("google-link-state");

  if (!state || !expectedState || state.length !== expectedState.length ||
      !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
    console.warn("[CSRF] Google link state mismatch");
    return NextResponse.redirect(new URL("/integracoes?error=invalid_state", request.url));
  }

  const code = url.searchParams.get("code");
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
