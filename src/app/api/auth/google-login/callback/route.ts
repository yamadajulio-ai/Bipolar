import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp } from "@/lib/security";
import { exchangeLoginCodeForTokens, getGoogleUserInfo } from "@/lib/google/login-auth";

const CONSENT_VERSION = 1;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get("google-login-state")?.value;

  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL("/login?error=csrf", request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url));
  }

  try {
    const tokens = await exchangeLoginCodeForTokens(code);
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/login?error=no_token", request.url));
    }

    const googleUser = await getGoogleUserInfo(tokens.access_token);

    if (!googleUser.verified_email) {
      return NextResponse.redirect(new URL("/login?error=email_not_verified", request.url));
    }

    const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const maskedIp = maskIp(rawIp);

    const googleSelectFields = { id: true, email: true, name: true, onboarded: true } as const;

    // 1. Find by googleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { googleSub: googleUser.id },
      select: googleSelectFields,
    });

    if (!user) {
      // 2. Find by email (link existing account)
      user = await prisma.user.findUnique({
        where: { email: googleUser.email },
        select: googleSelectFields,
      });

      if (user) {
        // Link Google account to existing user + ensure consents exist
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: {
              googleSub: googleUser.id,
              name: user.name || googleUser.name,
            },
          }),
          // Backfill essential consents if missing (user may have signed up before consent step)
          prisma.consent.createMany({
            data: [
              { userId: user.id, scope: "health_data", version: CONSENT_VERSION, ipAddress: maskedIp },
              { userId: user.id, scope: "terms_of_use", version: CONSENT_VERSION, ipAddress: maskedIp },
            ],
            skipDuplicates: true,
          }),
        ]);
      } else {
        // 3. Create new user (no password) + essential consents atomically
        user = await prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: googleUser.email,
              authProvider: "google",
              googleSub: googleUser.id,
              name: googleUser.name,
            },
            select: googleSelectFields,
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
    response.cookies.delete("google-login-state");
    return response;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "google-login-callback" } });
    console.error("Google login callback error:", err);
    return NextResponse.redirect(new URL("/login?error=google_login_failed", request.url));
  }
}
