import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { maskIp } from "@/lib/security";

const HEADERS = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // RBAC check
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: HEADERS });
  }

  const { action, feedbackId, metadata } = body;
  if (typeof action !== "string" || !action) {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400, headers: HEADERS });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Redact metadata: only allow IDs and types, never raw text/tokens/PII
  let safeMetadata: string | null = null;
  if (metadata && typeof metadata === "object") {
    const { entityType, entityId } = metadata;
    if (entityType && entityId) {
      safeMetadata = JSON.stringify({ entityType: String(entityType), entityId: String(entityId) });
    }
  } else if (feedbackId) {
    safeMetadata = JSON.stringify({ feedbackId: String(feedbackId) });
  }

  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action,
      metadata: safeMetadata,
      ip: maskIp(ip),
    },
  });

  return NextResponse.json({ ok: true }, { headers: HEADERS });
}
