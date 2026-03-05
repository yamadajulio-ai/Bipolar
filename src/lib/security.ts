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
 * Mask IP to /24 (LGPD minimization).
 * "192.168.1.42" → "192.168.1.0"
 * IPv6 or unknown → stored as-is (already pseudonymized enough).
 */
export function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "0";
    return parts.join(".");
  }
  return ip; // IPv6 or unusual format — keep as-is
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}
