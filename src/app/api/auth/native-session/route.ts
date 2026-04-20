/**
 * Bridge OAuth → Capacitor WebView session.
 *
 * The Capacitor app opens Google/Apple OAuth in SFSafariViewController (required
 * because embedded WebViews are blocked by Google). The callback cannot create
 * the iron-session cookie directly — Safari and the WebView have isolated cookie
 * jars. Instead, the callback signs a short-lived bridge token and redirects to
 * `suportebipolar://auth-success?token=...`. iOS closes Safari and hands the
 * URL to the app, which re-enters the WebView on this endpoint.
 *
 * Here we verify the token, look up the user, and set the real session cookie
 * on the WebView's cookie store — same iron-session contract as any other login.
 */
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { verifyBridgeToken } from "@/lib/oauth-native-bridge";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`native-session:${ip}`, 20, 900_000);
  if (!allowed) {
    return NextResponse.redirect(new URL("/login?error=rate_limited", request.url));
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", request.url));
  }

  const payload = verifyBridgeToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      select: { id: true, email: true, onboarded: true },
    });
    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    // Session rotation: destroy pre-auth cookie before creating the authenticated one
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
    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-session" } });
    return NextResponse.redirect(new URL("/login?error=session_failed", request.url));
  }
}
