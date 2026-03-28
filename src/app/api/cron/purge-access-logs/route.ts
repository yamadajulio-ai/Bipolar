import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";

/**
 * LGPD — Purge AccessLog entries older than 90 days.
 * Triggered by Vercel Cron (daily at 03:00 UTC).
 */
export async function GET(request: NextRequest) {
  // Always require Bearer token — fail-closed if CRON_SECRET not configured
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    { monitorSlug: "purge-access-logs", status: "in_progress" },
    {
      schedule: { type: "crontab", value: "0 3 * * *" },
      checkinMargin: 5,
      maxRuntime: 2,
      timezone: "Etc/UTC",
    },
  );

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

    // Purge used/expired password reset tokens older than 7 days
    const tokenCutoff = new Date();
    tokenCutoff.setDate(tokenCutoff.getDate() - 7);
    await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { usedAt: { lt: tokenCutoff } },
          { expiresAt: { lt: tokenCutoff } },
        ],
      },
    });

    Sentry.captureCheckIn({ checkInId, monitorSlug: "purge-access-logs", status: "ok" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: "purge-access-logs", status: "error" });
    Sentry.captureException(err, { tags: { endpoint: "cron-purge-access-logs" } });
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}
