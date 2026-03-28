import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { exchangeLoginCodeForTokens, getGoogleUserInfo } from "@/lib/google/login-auth";

export async function GET(request: NextRequest) {
  /** Helper: redirect to login with error + always clean up state cookie */
  function errorRedirect(error: string): NextResponse {
    const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    response.cookies.delete("google-login-state");
    return response;
  }

  // Rate limit FIRST — before parsing any request data
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`google-callback:${ip}`, 10, 900_000);
  if (!allowed) {
    return errorRedirect("rate_limited");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get("google-login-state")?.value;

  // Validate field sizes
  if (code && code.length > 2000) {
    return errorRedirect("invalid_request");
  }
  if (state && state.length > 200) {
    return errorRedirect("invalid_request");
  }

  if (!state || !storedState || state !== storedState) {
    return errorRedirect("csrf");
  }

  if (!code) {
    return errorRedirect("no_code");
  }

  try {
    const tokens = await exchangeLoginCodeForTokens(code);
    if (!tokens.access_token) {
      return errorRedirect("no_token");
    }

    const googleUser = await getGoogleUserInfo(tokens.access_token);

    // Normalize email for consistent DB lookups
    googleUser.email = googleUser.email.toLowerCase().trim();

    if (!googleUser.verified_email) {
      return errorRedirect("email_not_verified");
    }

    const googleSelectFields = { id: true, email: true, name: true, onboarded: true, passwordHash: true, appleSub: true } as const;

    // 1. Find by googleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { googleSub: googleUser.id },
      select: googleSelectFields,
    });

    if (!user) {
      // 2. Find by email (link existing account)
      const existingByEmail = await prisma.user.findUnique({
        where: { email: googleUser.email },
        select: googleSelectFields,
      });

      if (existingByEmail) {
        if (existingByEmail.passwordHash) {
          // SECURITY: Don't auto-link social provider to password-created account.
          // This prevents pre-hijacking: attacker registers victim's email with password,
          // then victim's Google login would attach to attacker's account.
          // User must log in with password and link Google explicitly.
          return errorRedirect("account_exists");
        }
        // SECURITY: Block cross-provider linking — prevents social-to-social hijacking.
        // If account was created via Apple, don't auto-link Google (and vice versa).
        if (existingByEmail.appleSub) {
          return errorRedirect("account_exists");
        }
        // Safe: no password AND no other social provider linked
        await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleSub: googleUser.id,
            name: existingByEmail.name || googleUser.name,
          },
        });
        user = existingByEmail;
      } else {
        // 3. Create new user (no password) — consents collected explicitly in onboarding
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            authProvider: "google",
            googleSub: googleUser.id,
            name: googleUser.name,
          },
          select: googleSelectFields,
        });
      }
    }

    // Session rotation: destroy pre-auth cookie before creating authenticated session
    const session = await getSession();
    await session.destroy();

    const freshSession = await getSession();
    freshSession.userId = user.id;
    freshSession.email = user.email;
    freshSession.isLoggedIn = true;
    freshSession.onboarded = user.onboarded;
    freshSession.lastActive = Date.now();
    freshSession.createdAt = Date.now();
    await freshSession.save();

    const redirectTo = user.onboarded ? "/hoje" : "/onboarding";
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.delete("google-login-state");
    return response;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "google-login-callback" } });
    console.error(JSON.stringify({ event: "google_login_callback_error", errorType: err instanceof Error ? err.constructor.name : "Unknown", message: (err as Error).message?.slice(0, 200) || "Unknown" }));
    return errorRedirect("google_login_failed");
  }
}
