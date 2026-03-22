import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
    return NextResponse.json({ error: "Data inválida" }, { status: 400 });
  }

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: session.userId, date: parsed.data.date } },
    select: { id: true, mode: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  }

  if (entry.mode !== "AUTO_FROM_SNAPSHOT") {
    return NextResponse.json({ error: "Apenas registros com snapshots podem ser confirmados" }, { status: 400 });
  }

  await prisma.diaryEntry.update({
    where: { id: entry.id },
    data: { summaryConfirmedAt: new Date() },
  });

  return NextResponse.json({ confirmed: true });
}
