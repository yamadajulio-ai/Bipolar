import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Health check endpoint for uptime monitoring (Sentry Uptime, external monitors).
 * Checks: app running + database reachable.
 * No auth required — returns minimal info, no PII.
 *
 * Also returns `minAppVersion` for native app force-update checks.
 * Bump this when a critical update requires all users to upgrade.
 */
const MIN_APP_VERSION = "1.0.0";
export async function GET() {
  const start = Date.now();

  try {
    // Lightweight DB check — single row count on small table
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        db: "ok",
        minAppVersion: MIN_APP_VERSION,
        latency: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "error",
        db: "unreachable",
        latency: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
