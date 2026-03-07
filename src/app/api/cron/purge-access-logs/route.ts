import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * LGPD — Purge AccessLog entries older than 90 days.
 * Triggered by Vercel Cron (daily at 03:00 UTC).
 */
export async function GET(request: NextRequest) {
  // Validate: Vercel Cron header or Bearer token
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization");
  const isAuthorized = authHeader === `Bearer ${process.env.CRON_SECRET}`;

  if (!isVercelCron && !isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    await prisma.accessLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // Also purge expired rate-limit rows
    await prisma.rateLimit.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
