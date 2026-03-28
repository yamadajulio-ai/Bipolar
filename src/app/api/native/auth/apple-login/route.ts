import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { verifyAppleIdentityToken, exchangeAppleCodeForTokens } from "@/lib/apple/auth";
import { encrypt } from "@/lib/crypto";
import { createNativeSession } from "@/lib/native-auth";

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
  // Native device info (required for token auth)
  deviceId: z.string().min(1).max(200),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(50).optional(),
});

/**
 * POST /api/native/auth/apple-login
 *
 * Sign in with Apple for native app — returns access + refresh tokens.
 * Same user resolution logic as web (find by appleSub → find by email → create).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    const allowed = await checkRateLimit(`native-apple-login:${ip}`, 10, 900_000);
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

    const { identityToken, authorizationCode, nonce, fullName, deviceId, platform, appVersion } = parsed.data;
    const appleUser = await verifyAppleIdentityToken(identityToken, nonce);

    if (!appleUser.email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    if (!appleUser.emailVerified) {
      return NextResponse.json({ error: "email_not_verified" }, { status: 400 });
    }

    // Normalize email for consistent DB lookups (web auth also normalizes)
    appleUser.email = appleUser.email.toLowerCase().trim();

    let encryptedAppleRefreshToken: string | undefined;
    if (authorizationCode) {
      const tokens = await exchangeAppleCodeForTokens(authorizationCode);
      if (tokens.refresh_token) {
        encryptedAppleRefreshToken = encrypt(tokens.refresh_token);
      }
    }

    const selectFields = { id: true, email: true, name: true, onboarded: true, passwordHash: true, googleSub: true } as const;

    const displayName = [fullName?.givenName, fullName?.familyName]
      .filter(Boolean)
      .join(" ") || undefined;

    // 1. Find by appleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { appleSub: appleUser.sub },
      select: selectFields,
    });

    if (user) {
      // Sync email if Apple now returns a different one (user changed Apple ID email)
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
        // 3. Create new user — consents collected explicitly in onboarding
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

    // Issue native tokens (no cookies, no session)
    const tokens = await createNativeSession({
      userId: user.id,
      deviceId,
      platform,
      appVersion,
      ip,
    });

    return NextResponse.json({
      success: true,
      onboarded: user.onboarded,
      ...tokens,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-apple-login" } });
    return NextResponse.json({ error: "apple_login_failed" }, { status: 500 });
  }
}
