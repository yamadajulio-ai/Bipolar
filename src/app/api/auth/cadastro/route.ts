import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { maskIp, checkRateLimit, getClientIp } from "@/lib/security";

const cadastroSchema = z.object({
  email: z.email("E-mail inválido").max(254),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128),
  confirmarSenha: z.string().max(128),
  ageGate: z.literal(true, "Você deve ter 18 anos ou mais"),
  healthConsent: z.literal(true, "Consentimento de dados de saúde obrigatório"),
}).check(
  (ctx) => {
    if (ctx.value.senha !== ctx.value.confirmarSenha) {
      ctx.issues.push({
        code: "custom",
        message: "Senhas não coincidem",
        input: ctx.value.confirmarSenha,
        path: ["confirmarSenha"],
      });
    }
  }
);

export async function POST(request: NextRequest) {
  // Rate limit: 5 signups per 15 minutes per IP
  const rawIp = getClientIp(request);
  const allowed = await checkRateLimit(`cadastro:${rawIp}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const parsed = cadastroSchema.safeParse(body);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path?.[0] || "geral");
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json({ errors: fieldErrors }, { status: 400 });
    }

    const { email: rawEmail, senha } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Check if email already exists — use generic error to prevent account enumeration
    // (in a health app, confirming account existence leaks sensitive info)
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    // Timing equalization: ALWAYS hash the password regardless of whether user exists.
    // Prevents timing side-channel that distinguishes "email taken" from "new email".
    const ip = maskIp(rawIp);
    const passwordHash = await hashPassword(senha);

    if (existing) {
      // Anti-enumeration: same status code + similar response shape as success.
      // Attacker cannot distinguish "email taken" from "new account" by status code.
      // The real success signal is the session cookie (httpOnly, not readable by JS).
      return NextResponse.json({ success: true }, { status: 201 });
    }
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        consents: {
          createMany: {
            data: [
              { scope: "health_data", ipAddress: ip },
              { scope: "terms_of_use", ipAddress: ip },
            ],
          },
        },
      },
      select: { id: true, email: true },
    });

    // Session rotation: destroy pre-auth cookie before creating authenticated session
    const session = await getSession();
    session.destroy();

    const freshSession = await getSession();
    freshSession.userId = user.id;
    freshSession.email = user.email;
    freshSession.isLoggedIn = true;
    freshSession.onboarded = false;
    freshSession.lastActive = Date.now();
    freshSession.createdAt = Date.now();
    await freshSession.save();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "cadastro" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
