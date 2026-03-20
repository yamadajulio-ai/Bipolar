import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, maskIp, getClientIp } from "@/lib/security";

// POST — Grant journal data consent
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`journal_consent:${session.userId}`, 5);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });
  }

  const ip = getClientIp(request);

  // Check if already consented
  const existing = await prisma.consent.findFirst({
    where: {
      userId: session.userId,
      scope: "journal_data",
      revokedAt: null,
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, existing: true });
  }

  await prisma.consent.create({
    data: {
      userId: session.userId,
      scope: "journal_data",
      ipAddress: maskIp(ip),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — Revoke journal data consent
export async function DELETE() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  await prisma.consent.updateMany({
    where: {
      userId: session.userId,
      scope: "journal_data",
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
