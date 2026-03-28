import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/sos/report — Report a dangerous/inappropriate chatbot response.
 * Logs to Sentry for review. Rate-limited to prevent abuse.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(
    session.isLoggedIn ? `sos-report:${session.userId}` : `sos-report:${ip}`,
    10,
    3_600_000,
  );
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const content = typeof body.content === "string" ? body.content.slice(0, 500) : "";
    const messageIndex = typeof body.messageIndex === "number" ? body.messageIndex : -1;

    Sentry.captureMessage("SOS chatbot response reported", {
      level: "warning",
      tags: { feature: "sos_report" },
      extra: {
        messageIndex,
        contentPreview: content.slice(0, 200),
        userId: session.isLoggedIn ? session.userId : "anonymous",
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
}
