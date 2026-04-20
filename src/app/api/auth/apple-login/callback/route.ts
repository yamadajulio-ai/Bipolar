import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { verifyAppleIdentityToken, exchangeAppleCodeForTokens } from "@/lib/apple/auth";
import { encrypt } from "@/lib/crypto";

/**
 * POST /api/auth/apple-login/callback
 *
 * Apple OAuth web callback — receives form_post from Apple's authorization server.
 * Apple sends: code, id_token, state, and optionally user (JSON with name/email on first consent).
 *
 * Flow: Apple → POST form_post → validate state → verify id_token → create/link user → redirect
 */
export async function POST(request: NextRequest) {
  /** Helper: redirect to login with error + always clean up state cookie */
  function errorRedirect(error: string): NextResponse {
    const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
    response.cookies.delete("apple-login-state");
    return response;
  }

  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`apple-callback:${ip}`, 10, 900_000);
  if (!allowed) {
    return errorRedirect("rate_limited");
  }

  const formData = await request.formData();

  const idToken = formData.get("id_token") as string | null;
  const code = formData.get("code") as string | null;
  const state = formData.get("state") as string | null;
  const storedState = request.cookies.get("apple-login-state")?.value;
  // Apple sends user info as JSON string on first authorization only
  const userJson = formData.get("user") as string | null;

  // Validate field sizes (parity with POST schema limits)
  if (idToken && idToken.length > 10000) {
    return errorRedirect("invalid_request");
  }
  if (code && code.length > 2000) {
    return errorRedirect("invalid_request");
  }
  if (state && state.length > 200) {
    return errorRedirect("invalid_request");
  }
  if (userJson && userJson.length > 5000) {
    return errorRedirect("invalid_request");
  }

  // CSRF: validate state matches cookie (timing-safe)
  if (!state || !storedState) {
    return errorRedirect("csrf");
  }
  const stateBuf = Buffer.from(state);
  const storedBuf = Buffer.from(storedState);
  if (stateBuf.length !== storedBuf.length || !timingSafeEqual(stateBuf, storedBuf)) {
    return errorRedirect("csrf");
  }

  if (!idToken) {
    return errorRedirect("no_token");
  }

  try {
    // Verify the id_token JWT directly (Apple includes it in the form_post)
    const appleUser = await verifyAppleIdentityToken(idToken);

    if (!appleUser.email) {
      return errorRedirect("apple_login_failed");
    }

    if (!appleUser.emailVerified) {
      return errorRedirect("email_not_verified");
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

    const selectFields = { id: true, email: true, name: true, onboarded: true, passwordHash: true, googleSub: true } as const;

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
      // Preserve the readable email: don't overwrite with Apple Private Relay alias, and don't
      // overwrite when the user also has Google/password (their primary email must win).
      const isRelayEmail = appleUser.email.endsWith("@privaterelay.appleid.com");
      const hasOtherProvider = !!user.googleSub || !!user.passwordHash;
      if (!isRelayEmail && !hasOtherProvider && user.email !== appleUser.email) {
        updateData.email = appleUser.email;
      }
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
          return errorRedirect("account_exists");
        }
        // SECURITY: Block cross-provider linking — prevents social-to-social hijacking.
        if (existingByEmail.googleSub) {
          return errorRedirect("account_exists");
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
    return errorRedirect("apple_login_failed");
  }
}
