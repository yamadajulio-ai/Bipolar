import { NextRequest, NextResponse } from "next/server";
import { getNativeAuth, revokeSession } from "@/lib/native-auth";
import * as Sentry from "@sentry/nextjs";

/**
 * POST /api/native/auth/logout
 *
 * Revokes the current native session.
 * Client must delete refresh token from Keychain after this call.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getNativeAuth(request);

    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
