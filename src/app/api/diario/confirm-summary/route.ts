import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Client must echo the aggregationVersion it saw — prevents confirming a stale projection */
  aggregationVersion: z.number().int().min(0),
  /** Client must echo the snapshotCount it saw — extra guard against race conditions */
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

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: session.userId, date: parsed.data.date } },
    select: { id: true, mode: true, aggregationVersion: true, snapshotCount: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  if (entry.mode !== "AUTO_FROM_SNAPSHOT") {
    return NextResponse.json({ error: "Apenas registros com snapshots podem ser confirmados" }, { status: 400 });
  }

  // Compare-and-set: reject if the projection changed since client last saw it
  // This prevents confirming a stale summary after a concurrent snapshot edit/creation
  if (
    entry.aggregationVersion !== parsed.data.aggregationVersion ||
    entry.snapshotCount !== parsed.data.snapshotCount
  ) {
    return NextResponse.json(
      { error: "O resumo foi atualizado. Recarregue a página e confirme novamente.", stale: true },
      { status: 409 },
    );
  }

  await prisma.diaryEntry.update({
    where: { id: entry.id },
    data: { summaryConfirmedAt: new Date() },
  });

  return NextResponse.json({ confirmed: true });
}
