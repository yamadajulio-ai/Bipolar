import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp, maskIp } from "@/lib/security";
import { verifyAppleIdentityToken, exchangeAppleCodeForTokens } from "@/lib/apple/auth";
import { encrypt } from "@/lib/crypto";

const CONSENT_VERSION = 1;

/**
 * POST /api/auth/apple-login
 *
 * Handles Sign in with Apple for both:
 * - Native iOS (Capacitor plugin sends identityToken directly)
 * - Web (after Apple callback, frontend sends identityToken)
 *
 * Validates the Apple identity token JWT, creates/links user, and establishes session.
 */

const schema = z.object({
  identityToken: z.string().min(100),
  authorizationCode: z.string().optional(),
  nonce: z.string().optional(),
  fullName: z
    .object({
      givenName: z.string().nullable().optional(),
      familyName: z.string().nullable().optional(),
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

    // Exchange auth code for refresh token (needed for account deletion/revocation)
    // Encrypt before storing — same pattern as Google refresh tokens
    let encryptedAppleRefreshToken: string | undefined;
    if (authorizationCode) {
      const tokens = await exchangeAppleCodeForTokens(authorizationCode);
      if (tokens.refresh_token) {
        encryptedAppleRefreshToken = encrypt(tokens.refresh_token);
      }
    }

    const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const maskedIp = maskIp(rawIp);

    const selectFields = { id: true, email: true, name: true, onboarded: true } as const;

    // Build display name from Apple's fullName (only sent on first sign-in)
    const displayName = [fullName?.givenName, fullName?.familyName]
      .filter(Boolean)
      .join(" ") || undefined;

    // 1. Find by appleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { appleSub: appleUser.sub },
      select: selectFields,
    });

    // Update refresh token for returning users (token may have been rotated)
    if (user && encryptedAppleRefreshToken) {
      await prisma.user.update({
        where: { id: user.id },
        data: { appleRefreshToken: encryptedAppleRefreshToken },
      });
    }

    if (!user) {
      // 2. Find by email (link existing account)
      user = await prisma.user.findUnique({
        where: { email: appleUser.email },
        select: selectFields,
      });

      if (user) {
        // Link Apple account to existing user
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: {
              appleSub: appleUser.sub,
              appleRefreshToken: encryptedAppleRefreshToken || undefined,
              name: user.name || displayName,
            },
          }),
          prisma.consent.createMany({
            data: [
              { userId: user.id, scope: "health_data", version: CONSENT_VERSION, ipAddress: maskedIp },
              { userId: user.id, scope: "terms_of_use", version: CONSENT_VERSION, ipAddress: maskedIp },
            ],
            skipDuplicates: true,
          }),
        ]);
      } else {
        // 3. Create new user (no password) + consents atomically
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: appleUser.email,
              authProvider: "apple",
              appleSub: appleUser.sub,
              appleRefreshToken: encryptedAppleRefreshToken || undefined,
              name: displayName,
            },
            select: selectFields,
          });
          await tx.consent.createMany({
            data: [
              { userId: newUser.id, scope: "health_data", version: CONSENT_VERSION, ipAddress: maskedIp },
              { userId: newUser.id, scope: "terms_of_use", version: CONSENT_VERSION, ipAddress: maskedIp },
            ],
          });
          return newUser;
        });
      }
    }

    // Session rotation: destroy pre-auth cookie before creating authenticated session
    const session = await getSession();
    session.destroy();

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
