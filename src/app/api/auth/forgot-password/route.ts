import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/security";
import { sendEmail } from "@/lib/email";

/** Hash token with SHA-256 before storing — raw token is only sent via email */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const schema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Strict rate limit: 5 requests per IP per 15 min
  const allowed = await checkRateLimit(`forgot-pwd:${ip}`, 5, 900_000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  const { email } = parsed.data;

  // Per-email rate limit: 3 per 15 min
  const emailAllowed = await checkRateLimit(`forgot-pwd:email:${email}`, 3, 900_000);
  if (!emailAllowed) {
    // Still return success to avoid email enumeration
    return NextResponse.json({ ok: true });
  }

  // Always return success (prevent email enumeration).
  // Timing mitigation: always do the DB lookup + token generation work
  // to avoid timing side-channels revealing user existence.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Generate token regardless (timing mitigation) — only store/send if user exists
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  if (user && user.passwordHash) {
    // Invalidate existing tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: { email, token: hashToken(token), expiresAt },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://suportebipolar.com"}/redefinir-senha?token=${token}`;

    await sendEmail({
      to: email,
      subject: "Redefinir sua senha — Suporte Bipolar",
      htmlBody: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #527a6e; margin-bottom: 16px;">Redefinir senha</h2>
          <p style="color: #333; line-height: 1.6;">
            Você solicitou a redefinição da sua senha no <strong>Suporte Bipolar</strong>.
          </p>
          <p style="color: #333; line-height: 1.6;">
            Clique no botão abaixo para criar uma nova senha. Este link expira em <strong>30 minutos</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; background-color: #527a6e; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Redefinir minha senha
            </a>
          </div>
          <p style="color: #666; font-size: 13px; line-height: 1.5;">
            Se você não solicitou isso, ignore este e-mail. Sua senha permanecerá a mesma.
          </p>
          <p style="color: #666; font-size: 13px; line-height: 1.5;">
            Caso o botão não funcione, copie e cole este link no navegador:<br/>
            <a href="${resetUrl}" style="color: #527a6e; word-break: break-all;">${resetUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 11px;">
            Suporte Bipolar — Ferramenta de autocuidado. Não substitui acompanhamento profissional.
          </p>
        </div>
      `,
      textBody: `Redefinir senha — Suporte Bipolar\n\nVocê solicitou a redefinição da sua senha.\n\nAcesse este link para criar uma nova senha (expira em 30 minutos):\n${resetUrl}\n\nSe você não solicitou isso, ignore este e-mail.\n\n—\nSuporte Bipolar`,
    });
  }

  return NextResponse.json({ ok: true });
}
