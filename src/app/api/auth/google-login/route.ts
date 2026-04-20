import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLoginAuthUrl } from "@/lib/google/login-auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { signBridgeToken } from "@/lib/oauth-native-bridge";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`google-login:${ip}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const isNative = request.nextUrl.searchParams.get("native") === "1";

  const session = await getSession();
  if (session.isLoggedIn) {
    // Native flow: Safari may still hold a prior session cookie that's useless
    // to the Capacitor WebView. Hand the app a bridge token so it can mint its
    // own session instead of stranding the user in Safari on /hoje.
    if (isNative) {
      const bridge = signBridgeToken(session.userId, !!session.onboarded);
      return NextResponse.redirect(
        `suportebipolar://auth-success?token=${encodeURIComponent(bridge)}`,
      );
    }
    return NextResponse.redirect(new URL("/hoje", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = getLoginAuthUrl(state);

  // Capacitor native flow: OAuth runs in SFSafariViewController (Google blocks
  // embedded WebViews). The callback must redirect to the suportebipolar://
  // custom scheme so iOS closes Safari and hands control back to the app.
  const response = NextResponse.redirect(authUrl);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  response.cookies.set("google-login-state", state, cookieOptions);
  if (isNative) {
    response.cookies.set("google-login-native", "1", cookieOptions);
  }

  return response;
}
