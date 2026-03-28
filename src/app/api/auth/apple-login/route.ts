import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { verifyAppleIdentityToken, exchangeAppleCodeForTokens, getAppleAuthUrl } from "@/lib/apple/auth";
import { encrypt } from "@/lib/crypto";
import crypto from "crypto";

/**
 * GET /api/auth/apple-login
 *
 * Redirects to Apple OAuth for web-based Sign in with Apple.
 * Sets a state cookie for CSRF protection (same pattern as Google login).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`apple-login-get:${ip}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.redirect(new URL("/hoje", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = getAppleAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  // sameSite: "none" is required because Apple sends a cross-origin POST (form_post).
  // Lax cookies are NOT sent on cross-origin POST — the callback would always fail CSRF.
  // Path-scoped to /api/auth/apple-login/callback to minimize exposure surface.
  response.cookies.set("apple-login-state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 600,
    path: "/api/auth/apple-login/callback",
  });

  return response;
}

/**
 * POST /api/auth/apple-login
 *
 * Handles Sign in with Apple for native iOS (Capacitor plugin sends identityToken directly).
 * Validates the Apple identity token JWT, creates/links user, and establishes session.
 */

const schema = z.object({
  identityToken: z.string().min(100).max(10000),
  authorizationCode: z.string().max(2000).optional(),
  nonce: z.string().max(500).optional(),
  fullName: z
    .object({
      givenName: z.string().max(200).nullable().optional(),
      familyName: z.string().max(200).nullable().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(`apple-login:${ip}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { identityToken, authorizationCode, nonce, fullName } = parsed.data;

  try {
    // Verify Apple JWT against Apple's public keys (with nonce replay protection)
    const appleUser = await verifyAppleIdentityToken(identityToken, nonce);

    if (!appleUser.email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    if (!appleUser.emailVerified) {
      return NextResponse.json({ error: "email_not_verified" }, { status: 400 });
    }

    // Normalize email for consistent DB lookups
    appleUser.email = appleUser.email.toLowerCase().trim();

    // Exchange auth code for refresh token (needed for account deletion/revocation)
    // Encrypt before storing — same pattern as Google refresh tokens
    let encryptedAppleRefreshToken: string | undefined;
    if (authorizationCode) {
      const tokens = await exchangeAppleCodeForTokens(authorizationCode);
      if (tokens.refresh_token) {
        encryptedAppleRefreshToken = encrypt(tokens.refresh_token);
      }
    }

    const selectFields = { id: true, email: true, name: true, onboarded: true, passwordHash: true, googleSub: true } as const;

    // Build display name from Apple's fullName (only sent on first sign-in)
    const displayName = [fullName?.givenName, fullName?.familyName]
      .filter(Boolean)
      .join(" ") || undefined;

    // 1. Find by appleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { appleSub: appleUser.sub },
      select: selectFields,
    });

    // Update refresh token + sync email for returning users
    if (user) {
      const updateData: Record<string, string> = {};
      if (encryptedAppleRefreshToken) updateData.appleRefreshToken = encryptedAppleRefreshToken;
      if (user.email !== appleUser.email) updateData.email = appleUser.email;
      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    if (!user) {
      // 2. Find by email (link existing account)
      const existingByEmail = await prisma.user.findUnique({
        where: { email: appleUser.email },
        select: selectFields,
      });

      if (existingByEmail) {
        if (existingByEmail.passwordHash) {
          // SECURITY: Don't auto-link social provider to password-created account.
          // Prevents pre-hijacking attack vector.
          return NextResponse.json({ error: "account_exists" }, { status: 409 });
        }
        // SECURITY: Block cross-provider linking — prevents social-to-social hijacking.
        if (existingByEmail.googleSub) {
          return NextResponse.json({ error: "account_exists" }, { status: 409 });
        }
        // Safe: no password AND no other social provider linked
        await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            appleSub: appleUser.sub,
            appleRefreshToken: encryptedAppleRefreshToken || undefined,
            name: existingByEmail.name || displayName,
          },
        });
        user = existingByEmail;
      } else {
        // 3. Create new user (no password) — consents collected explicitly in onboarding
        user = await prisma.user.create({
          data: {
            email: appleUser.email,
            authProvider: "apple",
            appleSub: appleUser.sub,
            appleRefreshToken: encryptedAppleRefreshToken || undefined,
            name: displayName,
          },
          select: selectFields,
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

    return NextResponse.json({
      ok: true,
      redirect: user.onboarded ? "/hoje" : "/onboarding",
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "apple-login" } });
    console.error(JSON.stringify({
      event: "apple_login_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: (err as Error).message?.slice(0, 200) || "Unknown",
    }));
    return NextResponse.json({ error: "apple_login_failed" }, { status: 500 });
  }
}
