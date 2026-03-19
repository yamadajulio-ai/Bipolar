import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

/**
 * GET /api/journal/export — Export all journal entries as JSON (LGPD data portability).
 * Returns full content with metadata; no caching, no logging content.
 */
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const allowed = await checkRateLimit(`journal_export:${session.userId}`, 3, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Limite de exportações atingido. Tente novamente em 1 hora." },
      { status: 429 },
    );
  }

  const entries = await prisma.journalEntry.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      content: true,
      maniaScore: true,
      depressionScore: true,
      energyScore: true,
      zoneAtCapture: true,
      mixedAtCapture: true,
      snapshotSource: true,
      entryDateLocal: true,
      timezone: true,
      aiUseAllowed: true,
      editedAt: true,
      createdAt: true,
    },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    format: "suporte-bipolar-journal-v1",
    totalEntries: entries.length,
    entries: entries.map((e) => ({
      ...e,
      editedAt: e.editedAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meu-diario-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}
