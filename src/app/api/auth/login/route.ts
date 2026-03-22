import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(1, "Senha é obrigatória"),
});

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

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 400 },
      );
    }

    const { email, senha } = parsed.data;

    // Email-based rate limit: 5 attempts per 15 min (tighter, prevents targeted brute force)
    if (!(await checkRateLimit(`login:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000))) {
      return NextResponse.json(
        { error: "Muitas tentativas para este e-mail. Aguarde 15 minutos." },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, onboarded: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Esta conta usa login social. Use o botão do Google para entrar." },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(senha, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 },
      );
    }

    // Session rotation: destroy pre-auth cookie before creating authenticated session
    // Prevents session fixation — any pre-existing cookie is invalidated
    const session = await getSession();
    session.destroy();

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
