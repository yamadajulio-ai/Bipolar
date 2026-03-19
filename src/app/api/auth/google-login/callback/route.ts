import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { exchangeLoginCodeForTokens, getGoogleUserInfo } from "@/lib/google/login-auth";

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

    // 1. Find by googleSub (returning user)
    let user = await prisma.user.findUnique({
      where: { googleSub: googleUser.id },
    });

    if (!user) {
      // 2. Find by email (link existing account)
      user = await prisma.user.findUnique({
        where: { email: googleUser.email },
      });

      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            googleSub: googleUser.id,
            name: user.name || googleUser.name,
          },
        });
      } else {
        // 3. Create new user (no password)
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            authProvider: "google",
            googleSub: googleUser.id,
            name: googleUser.name,
          },
        });
      }
    }

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isLoggedIn = true;
    session.onboarded = user.onboarded;
    session.lastActive = Date.now();
    await session.save();

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
