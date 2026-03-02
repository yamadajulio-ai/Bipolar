import { prisma } from "@/lib/db";

/**
 * Database-backed rate limiting (serverless-safe).
 * Each attempt creates a row that expires after windowMs.
 * Returns true if allowed, false if blocked.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000,
): Promise<boolean> {
  const now = new Date();

  // Clean expired entries for this key
  await prisma.rateLimit.deleteMany({
    where: { key, expiresAt: { lt: now } },
  });

  // Count active entries
  const count = await prisma.rateLimit.count({
    where: { key, expiresAt: { gte: now } },
  });

  if (count >= limit) {
    return false; // bloqueado
  }

  // Record this attempt
  await prisma.rateLimit.create({
    data: {
      key,
      expiresAt: new Date(now.getTime() + windowMs),
    },
  });

  return true; // permitido
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}
