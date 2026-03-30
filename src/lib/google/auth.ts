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

  // Auto-refresh if expired
  if (account.expiresAt.getTime() < Date.now()) {
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
        throw new Error("GOOGLE_REAUTH_REQUIRED");
      }
      throw err;
    }
  }

  return oauth2Client;
}
