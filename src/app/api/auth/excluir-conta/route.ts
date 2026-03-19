import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

/**
 * LGPD Art. 18, VI — Eliminação de dados pessoais.
 * Deletes the user and ALL associated data (Prisma cascade).
 * Rate-limited to prevent accidental/malicious repeated calls.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit: 3 deletion attempts per 24h per user
  const allowed = await checkRateLimit(`delete_account:${session.userId}`, 3, 24 * 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente amanhã." },
      { status: 429 },
    );
  }

  const userId = session.userId;

  try {
    // Revoke Google tokens before cascade delete (cleanup third-party state)
    const googleAccount = await prisma.googleAccount.findUnique({
      where: { userId },
      select: { refreshToken: true },
    });
    if (googleAccount?.refreshToken) {
      try {
        const { decrypt } = await import("@/lib/crypto");
        const token = decrypt(googleAccount.refreshToken);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: "POST" });
      } catch {
        // Log but continue — token cleanup is best-effort
        Sentry.captureMessage("Failed to revoke Google token on account deletion", { level: "warning" });
      }
    }

    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "excluir-conta" } });
    return NextResponse.json({ error: "Erro ao excluir conta" }, { status: 500 });
  }

  session.destroy();

  // Redirect to landing page after deletion
  return NextResponse.redirect(new URL("/", request.url), 303);
}
