import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { maskIp, checkRateLimit } from "@/lib/security";

const cadastroSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(8, "Senha deve ter no mínimo 8 caracteres"),
  confirmarSenha: z.string(),
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
  const xff = request.headers.get("x-forwarded-for");
  const rawIp = xff ? xff.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
  const allowed = await checkRateLimit(`cadastro:${rawIp}`, 5, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
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

    const { email, senha } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Este e-mail já está cadastrado." },
        { status: 409 },
      );
    }

    const ip = maskIp(rawIp);

    const passwordHash = await hashPassword(senha);
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
    });

    const session = await getSession();
    session.userId = user.id;
    session.email = user.email;
    session.isLoggedIn = true;
    session.onboarded = false;
    session.lastActive = Date.now();
    await session.save();

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "cadastro" } });
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
