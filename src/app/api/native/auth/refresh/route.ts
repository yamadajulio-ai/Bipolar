import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { rotateRefreshToken } from "@/lib/native-auth";
import * as Sentry from "@sentry/nextjs";

const refreshSchema = z.object({
  refreshToken: z.string().length(64),
});

/**
 * POST /api/native/auth/refresh
 *
 * Rotates refresh token and issues new access token.
 * - Old refresh token is invalidated
 * - If old token was already rotated (reuse), entire family is revoked
 * - New refresh token must replace old one in Keychain
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Rate limit refresh attempts (prevents brute-force token guessing)
    if (!(await checkRateLimit(`native-refresh:${ip}`, 30, 60 * 1000))) {
      return NextResponse.json(
        { error: "Too many refresh attempts." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing refresh token." },
        { status: 400 },
      );
    }

    const result = await rotateRefreshToken(parsed.data.refreshToken, ip);

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-refresh" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
