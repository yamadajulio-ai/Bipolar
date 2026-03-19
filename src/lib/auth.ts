import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import argon2 from "argon2";
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

  // Migrate legacy cookie transparently — will be removed after 2026-06-01
  const legacy = await getIronSession<SessionData>(cookieStore, legacySessionOptions);
  if (legacy.isLoggedIn && legacy.userId && legacy.email) {
    // Validate: user must still exist in DB before accepting legacy session
    const { prisma } = await import("@/lib/db");
    const user = await prisma.user.findUnique({
      where: { id: legacy.userId },
      select: { id: true, email: true, onboarded: true },
    });
    if (user && user.email === legacy.email) {
      session.userId = user.id;
      session.email = user.email;
      session.isLoggedIn = true;
      session.onboarded = user.onboarded;
      await session.save();
    }
    // Always destroy legacy cookie regardless
    await legacy.destroy();
  }

  return session;
}

/** Check if a hash is bcrypt (legacy) vs argon2id (current) */
function isBcryptHash(hash: string): boolean {
  return hash.startsWith("$2a$") || hash.startsWith("$2b$");
}

/** New hashes use argon2id (OWASP recommended) */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/** Verify password against argon2id or legacy bcrypt hashes */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }
  return argon2.verify(hash, password);
}

/** Hash PIN with argon2id */
export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, { type: argon2.argon2id });
}

/** Verify PIN against argon2id or legacy bcrypt hashes */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(pin, hash);
  }
  return argon2.verify(hash, pin);
}
