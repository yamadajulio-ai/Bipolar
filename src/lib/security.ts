import { prisma } from "@/lib/db";

/**
 * Database-backed rate limiting (serverless-safe).
 * Uses $transaction for atomicity — prevents race conditions
 * where concurrent requests could bypass the limit.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000,
): Promise<boolean> {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Clean expired entries for this key
    await tx.rateLimit.deleteMany({
      where: { key, expiresAt: { lt: now } },
    });

    // Count active entries
    const count = await tx.rateLimit.count({
      where: { key, expiresAt: { gte: now } },
    });

    if (count >= limit) {
      return false; // bloqueado
    }

    // Record this attempt
    await tx.rateLimit.create({
      data: {
        key,
        expiresAt: new Date(now.getTime() + windowMs),
      },
    });

    return true; // permitido
  });
}

/**
 * Read-only rate-limit check — does NOT increment the counter.
 * Returns true if the key has reached or exceeded the limit (i.e., is blocked).
 * Used to check delivery markers without consuming a slot.
 */
export async function isRateLimited(
  key: string,
  limit: number = 1,
): Promise<boolean> {
  const now = new Date();
  const count = await prisma.rateLimit.count({
    where: { key, expiresAt: { gte: now } },
  });
  return count >= limit;
}

/** Mask email: "user@example.com" → "u***@example.com" */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Mask IP to /24 (LGPD minimization).
 * "192.168.1.42" → "192.168.1.0"
 * IPv6 or unknown → stored as-is (already pseudonymized enough).
 */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  // IPv4: mask to /24
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "0";
    return parts.join(".");
  }
  // IPv6: mask to /64 (keep first 4 groups)
  if (ip.includes(":")) {
    const groups = ip.split(":");
    if (groups.length >= 4) {
      return groups.slice(0, 4).join(":") + ":0:0:0:0";
    }
  }
  return "[masked]";
}

/**
 * Extract real client IP from request headers.
 * Supports Cloudflare proxy (CF-Connecting-IP) with fallback to x-forwarded-for.
 * Always takes the first IP in a comma-separated list to avoid spoofing.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

// ── CSRF Double-Submit Cookie (HMAC-signed) ─────────────────

/** Cookie name: __Host- prefix enforces Secure + no Domain + Path=/ (dev falls back to unprefixed) */
export const CSRF_COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-csrf" : "csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Encode bytes to hex string (Edge Runtime compatible — no Buffer).
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Import SESSION_SECRET as HMAC key for Web Crypto API.
 * Cached per isolate — no re-import on every call.
 */
let _csrfKey: CryptoKey | null = null;
async function getCsrfKey(): Promise<CryptoKey> {
  if (_csrfKey) return _csrfKey;
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for CSRF");
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters for security");
  // Basic entropy check: reject secrets with all identical characters
  if (new Set(secret).size < 8) throw new Error("SESSION_SECRET has insufficient entropy (too few unique characters)");
  const enc = new TextEncoder();
  _csrfKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
  false,
    ["sign", "verify"],
  );
  return _csrfKey;
}

/**
 * Generate an HMAC-signed CSRF token: `nonce.signature`
 * - nonce: 32 random bytes (hex)
 * - signature: HMAC-SHA256(SESSION_SECRET, nonce) (hex)
 * Works in Edge Runtime (Web Crypto API).
 */
export async function generateCsrfToken(): Promise<string> {
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = toHex(nonceBytes);

  const key = await getCsrfKey();
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(nonce));
  const sigHex = toHex(new Uint8Array(sig));

  return `${nonce}.${sigHex}`;
}

/**
 * Validate CSRF: cookie and header must match, and signature must be valid.
 * 1. Cookie value === header value (constant-time)
 * 2. HMAC signature on nonce is valid (prevents token forgery)
 */
export async function validateCsrfToken(
  cookieValue: string | undefined,
  headerValue: string | null,
): Promise<boolean> {
  if (!cookieValue || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;

  // Constant-time comparison: cookie must equal header
  let mismatch = 0;
  for (let i = 0; i < cookieValue.length; i++) {
    mismatch |= cookieValue.charCodeAt(i) ^ headerValue.charCodeAt(i);
  }
  if (mismatch !== 0) return false;

  // Verify HMAC signature
  const dotIdx = cookieValue.indexOf(".");
  if (dotIdx === -1) return false;
  const nonce = cookieValue.slice(0, dotIdx);
  const sigHex = cookieValue.slice(dotIdx + 1);

  // Basic format check
  if (nonce.length !== 64 || sigHex.length !== 64) return false;

  try {
    const key = await getCsrfKey();
    const enc = new TextEncoder();
    const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(nonce));
  } catch {
    return false;
  }
}
