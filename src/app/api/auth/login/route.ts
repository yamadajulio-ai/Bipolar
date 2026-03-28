import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const loginSchema = z.object({
  email: z.email("E-mail inválido").max(254),
  senha: z.string().min(1, "Senha é obrigatória").max(128),
});

// Pre-computed argon2id hash for timing equalization when user doesn't exist.
// Prevents timing side-channel that distinguishes "user not found" from "wrong password".
const DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$tBD9xV/UPu6/2R6Fg842mA$ALai12wmLgzjNATBdJDSk+tgrWb2l8wu1wyHOKhbg9A";
const AUTH_ERROR = "E-mail ou senha incorretos.";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // IP-based rate limit: 10 attempts per 15 min (broader, catches spray attacks)
    if (!(await checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Muitas tentativas de login. Aguarde 15 minutos." },
        { status: 429 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 400 });
    }

    const { email: rawEmail, senha } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Email-based rate limit: 5 attempts per 15 min (tighter, prevents targeted brute force)
    if (!(await checkRateLimit(`login:email:${email}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Muitas tentativas para este e-mail. Aguarde 15 minutos." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, onboarded: true },
    });

    // Timing equalization: always run a verify operation regardless of user existence.
    // This prevents timing attacks that enumerate accounts in a health app.
    if (!user || !user.passwordHash) {
      await verifyPassword(senha, DUMMY_HASH);
      return NextResponse.json({ error: AUTH_ERROR }, { status: 401 });
    }

    const valid = await verifyPassword(senha, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: AUTH_ERROR }, { status: 401 });
    }

    // Session rotation: destroy pre-auth cookie before creating authenticated session
    // Prevents session fixation — any pre-existing cookie is invalidated
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

    return NextResponse.json({ success: true, onboarded: user.onboarded });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "login" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
