import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Client must echo the aggregationVersion it saw — concurrency token for CAS */
  aggregationVersion: z.number().int().min(0),
  /** Client must echo the snapshotCount it saw — extra concurrency token */
  snapshotCount: z.number().int().min(1),
});

/** PATCH /api/diario/confirm-summary — user confirms the day's aggregated summary */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!(await checkRateLimit(`diary_confirm:${session.userId}`, 30, 60_000))) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  // Atomic CAS: the WHERE clause carries the concurrency tokens (aggregationVersion + snapshotCount).
  // If a concurrent reprojectEntry() changed either value between the client read and this write,
  // the WHERE won't match and count === 0 → 409 Conflict.
  // This is a single UPDATE statement — PostgreSQL guarantees atomicity at the row level.
  const result = await prisma.diaryEntry.updateMany({
    where: {
      userId: session.userId,
      date: parsed.data.date,
      mode: "AUTO_FROM_SNAPSHOT",
      aggregationVersion: parsed.data.aggregationVersion,
      snapshotCount: parsed.data.snapshotCount,
    },
    data: { summaryConfirmedAt: new Date() },
  });

  if (result.count === 0) {
    // Either: entry not found, not AUTO_FROM_SNAPSHOT, or projection changed (stale tokens)
    // Check if entry exists at all to return a meaningful error
    const entry = await prisma.diaryEntry.findUnique({
      where: { userId_date: { userId: session.userId, date: parsed.data.date } },
      select: { mode: true },
    });

    if (!entry) {
      return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
    }
    if (entry.mode !== "AUTO_FROM_SNAPSHOT") {
      return NextResponse.json({ error: "Apenas registros com snapshots podem ser confirmados" }, { status: 400 });
    }
    // Projection changed between client read and this write — ask user to reload
    return NextResponse.json(
      { error: "O resumo foi atualizado. Recarregue a página e confirme novamente.", stale: true },
      { status: 409 },
    );
  }

  return NextResponse.json({ confirmed: true });
}
