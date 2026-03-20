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
