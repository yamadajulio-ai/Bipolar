import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state,
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(userId: string) {
  const account = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Google account not linked");

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    expiry_date: account.expiresAt.getTime(),
  });

  // Auto-refresh if expired. Re-read the row first: if a concurrent request
  // already refreshed in the last few seconds, reuse that token instead of
  // calling Google's /oauth/token a second time (which fails with
  // `invalid_grant` and would falsely trigger GOOGLE_REAUTH_REQUIRED).
  if (account.expiresAt.getTime() < Date.now()) {
    const fresh = await prisma.googleAccount.findUnique({
      where: { userId },
      select: { accessToken: true, refreshToken: true, expiresAt: true },
    });
    if (fresh && fresh.expiresAt.getTime() > Date.now() + 30_000) {
      oauth2Client.setCredentials({
        access_token: decrypt(fresh.accessToken),
        refresh_token: decrypt(fresh.refreshToken),
        expiry_date: fresh.expiresAt.getTime(),
      });
      return oauth2Client;
    }
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.googleAccount.update({
        where: { userId },
        data: {
          accessToken: encrypt(credentials.access_token!),
          expiresAt: new Date(credentials.expiry_date!),
        },
      });
      oauth2Client.setCredentials(credentials);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("invalid_grant")) {
        // Final check: a parallel refresh may have just landed.
        const final = await prisma.googleAccount.findUnique({
          where: { userId },
          select: { accessToken: true, refreshToken: true, expiresAt: true },
        });
        if (final && final.expiresAt.getTime() > Date.now() + 30_000) {
          oauth2Client.setCredentials({
            access_token: decrypt(final.accessToken),
            refresh_token: decrypt(final.refreshToken),
            expiry_date: final.expiresAt.getTime(),
          });
          return oauth2Client;
        }
        throw new Error("GOOGLE_REAUTH_REQUIRED");
      }
      throw err;
    }
  }

  return oauth2Client;
}
