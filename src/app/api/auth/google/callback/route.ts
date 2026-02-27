import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/google/auth";

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
        accessToken: tokens.access_token,
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      },
      create: {
        userId: session.userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || "",
        expiresAt: new Date(tokens.expiry_date || Date.now() + 3600000),
      },
    });

    return NextResponse.redirect(new URL("/integracoes?google=connected", request.url));
  } catch (err) {
    console.error("Google auth callback error:", err);
    return NextResponse.redirect(new URL("/integracoes?error=google_auth_failed", request.url));
  }
}
