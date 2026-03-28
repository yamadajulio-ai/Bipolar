import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { getSession, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { revokeAllUserSessions } from "@/lib/native-auth";
import { z } from "zod/v4";

const bodySchema = z.object({
  password: z.string().min(1, "Senha obrigatória").max(128).optional(),
});

/**
 * LGPD Art. 18, VI — Eliminação de dados pessoais.
 * Deletes the user and ALL associated data (Prisma cascade).
 * Requires step-up auth: password re-confirmation (email users)
 * or recent session check (Google OAuth users).
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

  // Step-up auth: verify identity before destructive action
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, authProvider: true, appleSub: true, appleRefreshToken: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (user.authProvider === "email") {
    // Email users must re-confirm password
    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch {
      return NextResponse.json(
        { error: "Confirme sua senha para excluir a conta.", requiresPassword: true },
        { status: 422 },
      );
    }
    if (!body.password || !user.passwordHash) {
      return NextResponse.json(
        { error: "Confirme sua senha para excluir a conta.", requiresPassword: true },
        { status: 422 },
      );
    }
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 403 });
    }
  } else {
    // OAuth users (Google/Apple): require fresh login (session created < 5 min ago).
    // Uses createdAt (login time), not lastActive (activity time) — true reauthentication.
    const REAUTH_WINDOW = 5 * 60 * 1000;
    if (!session.createdAt || Date.now() - session.createdAt > REAUTH_WINDOW) {
      return NextResponse.json(
        { error: "Faça login novamente antes de excluir a conta.", requiresReauth: true },
        { status: 403 },
      );
    }
  }

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
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `token=${encodeURIComponent(token)}`,
        });
      } catch {
        Sentry.captureMessage("Failed to revoke Google token on account deletion", { level: "warning" });
      }
    }

    // Revoke Apple tokens before cascade delete (Apple requirement for SIWA account deletion)
    if (user.appleRefreshToken) {
      try {
        const { decrypt } = await import("@/lib/crypto");
        const { revokeAppleToken } = await import("@/lib/apple/auth");
        const decryptedToken = decrypt(user.appleRefreshToken);
        const revoked = await revokeAppleToken(decryptedToken);
        if (!revoked) {
          Sentry.captureMessage("Failed to revoke Apple token on account deletion", { level: "warning" });
        }
      } catch {
        Sentry.captureMessage("Failed to revoke Apple token on account deletion", { level: "warning" });
      }
    }

    // Revoke all native sessions before cascade delete — prevents stale access tokens
    // from being valid during the 15-min token lifetime window
    await revokeAllUserSessions(userId).catch((err) => {
      Sentry.captureException(err, { level: "warning", tags: { endpoint: "excluir-conta", action: "revoke-native-sessions" } });
    });

    // Purge orphan PasswordResetTokens (no FK cascade — keyed by email, not userId)
    await prisma.passwordResetToken.deleteMany({
      where: { email: session.email },
    }).catch(() => {});

    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "excluir-conta" } });
    return NextResponse.json({ error: "Erro ao excluir conta" }, { status: 500 });
  }

  await session.destroy();

  // Clear all browser-side data (LGPD Art. 18 — complete data elimination)
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return response;
}
