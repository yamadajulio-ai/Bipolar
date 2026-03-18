import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";

export interface SessionData {
  userId: string;
  email: string;
  isLoggedIn: boolean;
  onboarded?: boolean;
}

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 dias
  path: "/",
};

const currentSessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "suporte-bipolar-session",
  cookieOptions: baseCookieOptions,
};

const legacySessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "empresa-bipolar-session",
  cookieOptions: baseCookieOptions,
};

export async function getSession() {
  const cookieStore = await cookies();

  const session = await getIronSession<SessionData>(cookieStore, currentSessionOptions);
  if (session.isLoggedIn) return session;

  // Migrate legacy cookie transparently
  const legacy = await getIronSession<SessionData>(cookieStore, legacySessionOptions);
  if (legacy.isLoggedIn) {
    session.userId = legacy.userId;
    session.email = legacy.email;
    session.isLoggedIn = true;
    session.onboarded = legacy.onboarded;
    await session.save();
    await legacy.destroy();
  }

  return session;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
