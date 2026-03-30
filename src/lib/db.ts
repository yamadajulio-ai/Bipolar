import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Retry wrapper for Prisma operations susceptible to Neon cold-start failures.
 * PrismaClientInitializationError occurs when Neon's serverless compute is
 * suspended and the TCP handshake/DNS resolution fails on first attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 2, delayMs = 1000 } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable =
        err instanceof Error &&
        (err.constructor.name === "PrismaClientInitializationError" ||
          err.message.includes("Can't reach database server"));
      if (!isRetryable || attempt >= retries) throw err;
      console.warn(`[Prisma] Retrying after cold-start error (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
}
