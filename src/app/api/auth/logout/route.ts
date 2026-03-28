import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const allowed = await checkRateLimit(`web-logout:${ip}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url), 303);
    }

    const session = await getSession();
    await session.destroy();
    const res = NextResponse.redirect(new URL("/", request.url), 303);
    // Clear all site data on logout — defense-in-depth for PHI
    res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    return res;
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "logout" } });
    return NextResponse.redirect(new URL("/", request.url), 303);
  }
}
