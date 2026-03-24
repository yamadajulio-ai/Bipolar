import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp } from "@/lib/security";

/** Per-scope consent version. Bump when the consent text/terms for a scope change. */
const SCOPE_VERSIONS: Record<string, number> = {
  push_notifications: 1,
  email_notifications: 1,
  whatsapp: 1,
  professional_sharing: 1,
  ai_narrative: 1,
  assessments: 1,
  crisis_plan: 1,
  sos_chatbot: 1,
  clinical_export: 1,
};
const MANAGEABLE_SCOPES = new Set(Object.keys(SCOPE_VERSIONS));

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

  // Attach currentVersion so the frontend can detect stale consents needing re-acceptance
  const enriched = consents.map((c) => ({
    ...c,
    currentVersion: SCOPE_VERSIONS[c.scope] ?? 1,
    needsReaccept: (SCOPE_VERSIONS[c.scope] ?? 1) > c.version,
  }));

  return NextResponse.json({ consents: enriched, scopeVersions: SCOPE_VERSIONS });
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
      select: { id: true, revokedAt: true, version: true },
      orderBy: { grantedAt: "desc" },
    });

    const scopeVersion = SCOPE_VERSIONS[scope] ?? 1;

    if (existing?.revokedAt) {
      // Re-grant: update existing record with current version
      await prisma.consent.update({
        where: { id: existing.id },
        data: { revokedAt: null, grantedAt: new Date(), version: scopeVersion, ipAddress: maskedIp },
      });
    } else if (existing && !existing.revokedAt && existing.version < scopeVersion) {
      // Active but stale version — re-accept bumps version
      await prisma.consent.update({
        where: { id: existing.id },
        data: { grantedAt: new Date(), version: scopeVersion, ipAddress: maskedIp },
      });
    } else if (!existing) {
      // First time granting this scope
      await prisma.consent.create({
        data: { userId: session.userId, scope, version: scopeVersion, ipAddress: maskedIp },
      });
    }
    // else: already active at current version, no-op
  } else {
    // Revoke: set revokedAt on active consent
    await prisma.consent.updateMany({
      where: { userId: session.userId, scope, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
