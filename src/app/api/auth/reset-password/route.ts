import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/security";

/** Hash token with SHA-256 to match stored hash */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const schema = z.object({
  token: z.string().min(64).max(64),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(`reset-pwd:${ip}`, 10, 900_000);
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
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { token, password } = parsed.data;

  // Find valid, unused, non-expired token (token is SHA-256 hashed in DB)
  const tokenHash = hashToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Link inválido ou expirado. Solicite um novo." },
      { status: 400 },
    );
  }

  // Hash new password and update user
  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { email: resetToken.email },
      data: { passwordHash, passwordChangedAt: new Date() },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
