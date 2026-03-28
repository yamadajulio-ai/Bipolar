import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp, maskIp } from "@/lib/security";
import { verifyAppleIdentityToken, exchangeAppleCodeForTokens } from "@/lib/apple/auth";
import { encrypt } from "@/lib/crypto";

const CONSENT_VERSION = 1;

/**
 * POST /api/auth/apple-login/callback
 *
 * Apple OAuth web callback — receives form_post from Apple's authorization server.
 * Apple sends: code, id_token, state, and optionally user (JSON with name/email on first consent).
 *
 * Flow: Apple → POST form_post → validate state → verify id_token → create/link user → redirect
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`apple-callback:${ip}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  const formData = await request.formData();

  const idToken = formData.get("id_token") as string | null;
  const code = formData.get("code") as string | null;
  const state = formData.get("state") as string | null;
  const storedState = request.cookies.get("apple-login-state")?.value;
  // Apple sends user info as JSON string on first authorization only
  const userJson = formData.get("user") as string | null;

  // CSRF: validate state matches cookie
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=csrf", request.url));
  }

  if (!idToken) {
    return NextResponse.redirect(new URL("/login?error=no_token", request.url));
  }

  try {
    // Verify the id_token JWT directly (Apple includes it in the form_post)
    const appleUser = await verifyAppleIdentityToken(idToken);

    if (!appleUser.email) {
      return NextResponse.redirect(new URL("/login?error=apple_login_failed", request.url));
    }

    if (!appleUser.emailVerified) {
      return NextResponse.redirect(new URL("/login?error=email_not_verified", request.url));
    }

    // Normalize email for consistent DB lookups
    appleUser.email = appleUser.email.toLowerCase().trim();

    // Exchange authorization code for refresh token (needed for account deletion/revocation)
    let encryptedAppleRefreshToken: string | undefined;
    if (code) {
      const tokens = await exchangeAppleCodeForTokens(code, process.env.APPLE_REDIRECT_URI);
      if (tokens.refresh_token) {
        encryptedAppleRefreshToken = encrypt(tokens.refresh_token);
      }
    }

    const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const maskedIp = maskIp(rawIp);

    const selectFields = { id: true, email: true, name: true, onboarded: true } as const;

    // Parse display name from Apple's user JSON (only sent on first consent)
    let displayName: string | undefined;
    if (userJson) {
      try {
        const userData = JSON.parse(userJson);
        displayName = [userData.name?.firstName, userData.name?.lastName]
          .filter(Boolean)
          .join(" ") || undefined;
      } catch {
        // Invalid JSON — ignore, name is optional
      }
    }

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

    const redirectTo = user.onboarded ? "/hoje" : "/onboarding";
    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.delete("apple-login-state");
    return response;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "apple-login-callback" } });
    console.error(JSON.stringify({
      event: "apple_login_callback_error",
      errorType: err instanceof Error ? err.constructor.name : "Unknown",
      message: (err as Error).message?.slice(0, 200) || "Unknown",
    }));
    return NextResponse.redirect(new URL("/login?error=apple_login_failed", request.url));
  }
}
