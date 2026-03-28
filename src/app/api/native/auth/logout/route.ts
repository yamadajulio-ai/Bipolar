import { NextRequest, NextResponse } from "next/server";
import { getNativeAuth, revokeSession } from "@/lib/native-auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/native/auth/logout
 *
 * Revokes the current native session.
 * Client must delete refresh token from Keychain after this call.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const allowed = await checkRateLimit(`native-logout:${ip}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const auth = await getNativeAuth(request);

    if (!auth) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    await revokeSession(auth.sessionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-logout" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
