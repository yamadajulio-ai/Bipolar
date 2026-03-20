import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp } from "@/lib/security";

const CONSENT_VERSION = 1;
const MANAGEABLE_SCOPES = new Set([
  "push_notifications", "email_notifications", "whatsapp",
  "professional_sharing", "ai_narrative",
]);

// GET — list all current consents
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const consents = await prisma.consent.findMany({
    where: { userId: session.userId, revokedAt: null },
    select: { scope: true, version: true, grantedAt: true },
    orderBy: { grantedAt: "asc" },
  });

  return NextResponse.json({ consents });
}

// POST — grant or revoke a consent
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let scope: string;
  let action: "grant" | "revoke";
  try {
    const body = await request.json();
    scope = body.scope;
    action = body.action;
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  if (!scope || !MANAGEABLE_SCOPES.has(scope)) {
    return NextResponse.json(
      { error: "Escopo inválido. Consentimentos essenciais não podem ser alterados aqui." },
      { status: 400 },
    );
  }

  if (action !== "grant" && action !== "revoke") {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const maskedIp = maskIp(rawIp);

  if (action === "grant") {
    // Create new consent (skipDuplicates if already active)
    await prisma.consent.createMany({
      data: [{ userId: session.userId, scope, version: CONSENT_VERSION, ipAddress: maskedIp }],
      skipDuplicates: true,
    });
  } else {
    // Revoke: set revokedAt on active consent
    await prisma.consent.updateMany({
      where: { userId: session.userId, scope, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
