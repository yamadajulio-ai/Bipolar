import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp } from "@/lib/security";

const CONSENT_VERSION = 1;
const MANAGEABLE_SCOPES = new Set([
  "push_notifications", "email_notifications", "whatsapp",
  "professional_sharing", "ai_narrative",
  "assessments", "crisis_plan", "sos_chatbot", "clinical_export",
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
    // Check if there's a revoked consent for this scope — re-activate it
    const existing = await prisma.consent.findFirst({
      where: { userId: session.userId, scope },
      select: { id: true, revokedAt: true },
      orderBy: { grantedAt: "desc" },
    });

    if (existing?.revokedAt) {
      // Re-grant: update existing record
      await prisma.consent.update({
        where: { id: existing.id },
        data: { revokedAt: null, grantedAt: new Date(), version: CONSENT_VERSION, ipAddress: maskedIp },
      });
    } else if (!existing) {
      // First time granting this scope
      await prisma.consent.create({
        data: { userId: session.userId, scope, version: CONSENT_VERSION, ipAddress: maskedIp },
      });
    }
    // else: already active, no-op
  } else {
    // Revoke: set revokedAt on active consent
    await prisma.consent.updateMany({
      where: { userId: session.userId, scope, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
