import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { prisma } from "@/lib/db";

export interface ProfessionalSessionData {
  token: string;
  patientUserId: string;
  patientName: string;
  isViewer: boolean;
  createdAt: number;
}

const COOKIE_NAME = "suporte-bipolar-prof";
const MAX_AGE = 2 * 60 * 60; // 2 hours

const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: MAX_AGE,
    path: "/",
  },
};

/**
 * Get professional viewer session. Returns null if:
 * - No session cookie
 * - Session expired (>2h)
 * - Token doesn't match URL
 */
export async function getProfessionalSession(
  token?: string,
): Promise<ProfessionalSessionData | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<ProfessionalSessionData>(
    cookieStore,
    sessionOptions,
  );

  if (!session.isViewer || !session.token || !session.patientUserId) {
    return null;
  }

  if (token && session.token !== token) {
    return null;
  }

  if (Date.now() - session.createdAt > MAX_AGE * 1000) {
    await session.destroy();
    return null;
  }

  return session;
}

/**
 * Validate that the professional access token is still active in the DB.
 */
export async function validateProfessionalAccess(
  token: string,
): Promise<{ valid: boolean; patientUserId?: string; patientName?: string }> {
  const access = await prisma.professionalAccess.findUnique({
    where: { token },
    select: {
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: { name: true } },
    },
  });

  if (!access || access.revokedAt || access.expiresAt < new Date()) {
    return { valid: false };
  }

  return {
    valid: true,
    patientUserId: access.userId,
    patientName: access.user?.name ?? "Paciente",
  };
}

/**
 * Create a professional session after successful PIN validation.
 */
export async function createProfessionalSession(
  token: string,
  patientUserId: string,
  patientName: string,
): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<ProfessionalSessionData>(
    cookieStore,
    sessionOptions,
  );

  session.token = token;
  session.patientUserId = patientUserId;
  session.patientName = patientName;
  session.isViewer = true;
  session.createdAt = Date.now();

  await session.save();
}

/**
 * Destroy professional session.
 */
export async function destroyProfessionalSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<ProfessionalSessionData>(
    cookieStore,
    sessionOptions,
  );
  await session.destroy();
}
