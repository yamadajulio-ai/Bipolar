/**
 * Native App Authentication (B-lite iOS)
 *
 * Token-based auth for Capacitor native app.
 * - Access token: opaque, short-lived (15min), stored in memory on client
 * - Refresh token: opaque, long-lived (30d), stored in Keychain on client
 * - Refresh token rotation: new token on every refresh, old one invalidated
 * - Reuse detection: if a rotated-away token is reused, entire family revoked
 *
 * Web auth (iron-session + cookies) is untouched — this is a parallel layer.
 */

import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { maskIp } from "@/lib/security";

function getAccessTokenSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required for native auth");
  return secret;
}

// ─── Token Lifetimes ────────────────────────────────────────────────
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ─── Token Generation ───────────────────────────────────────────────

/** Generate a cryptographically secure opaque token (32 bytes → 64 hex chars). */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** Generate a token family ID (groups all rotated tokens from one login). */
export function generateTokenFamily(): string {
  return randomBytes(16).toString("hex");
}

/** SHA-256 hash of a token (stored in DB, never the raw token). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─── Access Token (stateless-ish, stored in DB for revocation check) ─

interface AccessTokenPayload {
  userId: string;
  sessionId: string;
  exp: number;
}

/**
 * Encode access token as HMAC-signed base64url.
 * Format: base64url(payload).hmac-sha256(payload, SESSION_SECRET)
 * Not a JWT — simpler, but tamper-proof. Server validates signature + DB session.
 */
export function encodeAccessToken(payload: AccessTokenPayload): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64url");
  const sig = createHmac("sha256", getAccessTokenSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Decode and verify access token. Returns null if malformed, tampered, or expired. */
export function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const dotIndex = token.indexOf(".");
    if (dotIndex === -1) return null;

    const data = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    // Verify HMAC signature (constant-time comparison via timingSafeEqual)
    const expectedSig = createHmac("sha256", getAccessTokenSecret()).update(data).digest("base64url");
    if (sig.length !== expectedSig.length) return null;
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const json = Buffer.from(data, "base64url").toString("utf8");
    const payload = JSON.parse(json) as AccessTokenPayload;
    if (!payload.userId || !payload.sessionId || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Session Operations ─────────────────────────────────────────────

interface CreateSessionInput {
  userId: string;
  deviceId: string;
  platform: string;
  appVersion?: string;
  ip?: string;
}

interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Create a new native session (called on login).
 * Returns access token + refresh token pair.
 */
export async function createNativeSession(
  input: CreateSessionInput,
): Promise<SessionTokens> {
  const refreshToken = generateToken();
  const family = generateTokenFamily();

  const session = await prisma.nativeSession.create({
    data: {
      userId: input.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      refreshTokenHash: hashToken(refreshToken),
      tokenFamily: family,
      lastIp: input.ip ? maskIp(input.ip) : null,
    },
  });

  const accessToken = encodeAccessToken({
    userId: input.userId,
    sessionId: session.id,
    exp: Date.now() + ACCESS_TOKEN_TTL_MS,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };
}

/**
 * Rotate refresh token (called on /api/native/auth/refresh).
 * - Validates the old refresh token
 * - Issues new refresh token + new access token
 * - Invalidates the old refresh token
 * - If the old token was already rotated (reuse), revokes entire family
 */
export async function rotateRefreshToken(
  oldRefreshToken: string,
  ip?: string,
): Promise<SessionTokens | { error: string; status: number }> {
  const oldHash = hashToken(oldRefreshToken);

  // Find session by refresh token hash
  const session = await prisma.nativeSession.findUnique({
    where: { refreshTokenHash: oldHash },
  });

  // Case 1: Token not found — might be already rotated (reuse attempt)
  if (!session) {
    // Check if this hash appears as a rotatedFrom (indicates reuse of old token)
    const descendant = await prisma.nativeSession.findFirst({
      where: { rotatedFrom: oldHash, revokedAt: null },
    });

    if (descendant) {
      // REUSE DETECTED — revoke entire token family
      await prisma.nativeSession.updateMany({
        where: { tokenFamily: descendant.tokenFamily },
        data: { revokedAt: new Date() },
      });
      return { error: "Reutilização de token detectada — todas as sessões revogadas", status: 401 };
    }

    return { error: "Token inválido", status: 401 };
  }

  // Case 2: Session is revoked
  if (session.revokedAt) {
    return { error: "Sessão revogada", status: 401 };
  }

  // Case 2b: Refresh token expired (30-day absolute lifetime)
  if (Date.now() - session.createdAt.getTime() > REFRESH_TOKEN_TTL_MS) {
    // Revoke expired session for cleanup
    await prisma.nativeSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }).catch(() => {});
    return { error: "Sessão expirada", status: 401 };
  }

  // Case 3: Valid token — rotate atomically
  // Use updateMany with refreshTokenHash in WHERE to prevent race conditions:
  // if two concurrent requests hit with the same token, only one succeeds.
  const newRefreshToken = generateToken();
  const newHash = hashToken(newRefreshToken);

  const { count } = await prisma.nativeSession.updateMany({
    where: { id: session.id, refreshTokenHash: oldHash },
    data: {
      refreshTokenHash: newHash,
      rotatedFrom: oldHash,
      lastSeenAt: new Date(),
      lastIp: ip ? maskIp(ip) : session.lastIp,
    },
  });

  // Race condition: another request already rotated this token
  if (count === 0) {
    return { error: "Token já rotacionado (requisição concorrente)", status: 401 };
  }

  const accessToken = encodeAccessToken({
    userId: session.userId,
    sessionId: session.id,
    exp: Date.now() + ACCESS_TOKEN_TTL_MS,
  });

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  };
}

/**
 * Validate an access token from Authorization header.
 * Returns userId if valid, null otherwise.
 */
export async function validateAccessToken(
  authHeader: string | null,
): Promise<{ userId: string; sessionId: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const payload = decodeAccessToken(token);
  if (!payload) return null;

  // Verify session still exists and is not revoked
  const session = await prisma.nativeSession.findUnique({
    where: { id: payload.sessionId },
    select: { revokedAt: true, userId: true },
  });

  if (!session || session.revokedAt) return null;
  if (session.userId !== payload.userId) return null;

  return { userId: payload.userId, sessionId: payload.sessionId };
}

/**
 * Revoke a single session (logout).
 * Uses updateMany to avoid throwing if session already deleted/revoked.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await prisma.nativeSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all sessions for a user (password change, account deletion).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.nativeSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Helper to extract and validate native auth from a request.
 * Used by /api/native/* route handlers.
 */
export async function getNativeAuth(
  request: Request,
): Promise<{ userId: string; sessionId: string } | null> {
  const authHeader = request.headers.get("authorization");
  return validateAccessToken(authHeader);
}
