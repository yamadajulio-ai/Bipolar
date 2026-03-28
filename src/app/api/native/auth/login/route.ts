import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { createNativeSession } from "@/lib/native-auth";
import * as Sentry from "@sentry/nextjs";

/** Pre-computed valid argon2id hash for constant-time comparison when user not found */
const DUMMY_HASH_PROMISE = hashPassword("timing-equalization-dummy-value");

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(1, "Senha é obrigatória").max(128),
  deviceId: z.string().min(1).max(200),
  platform: z.enum(["ios", "android"]),
  appVersion: z.string().max(50).optional(),
});

/**
 * POST /api/native/auth/login
 *
 * Native app login — returns access token + refresh token (no cookies).
 * Refresh token must be stored in Keychain (iOS) or Keystore (Android).
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    if (!(await checkRateLimit(`native-login:${ip}`, 10, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Muitas tentativas de login. Aguarde 15 minutos." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 400 },
      );
    }

    const { email: rawEmail, senha, deviceId, platform, appVersion } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    if (!(await checkRateLimit(`native-login:email:${email}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Muitas tentativas para este e-mail. Aguarde 15 minutos." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, onboarded: true },
    });

    if (!user || !user.passwordHash) {
      const dummyHash = await DUMMY_HASH_PROMISE;
      await verifyPassword(senha, dummyHash);
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    const valid = await verifyPassword(senha, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    const tokens = await createNativeSession({
      userId: user.id,
      deviceId,
      platform,
      appVersion,
      ip,
    });

    return NextResponse.json({
      success: true,
      onboarded: user.onboarded,
      ...tokens,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "native-login" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
