import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getLoginAuthUrl } from "@/lib/google/login-auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const allowed = await checkRateLimit(`google-login:${ip}`, 10, 900_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const session = await getSession();
  if (session.isLoggedIn) {
    return NextResponse.redirect(new URL("/hoje", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const authUrl = getLoginAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google-login-state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
