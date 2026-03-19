import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import * as Sentry from "@sentry/nextjs";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  const allowed = await checkRateLimit(`financeiro_range_read:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições" }, { status: 429, headers: HEADERS });
  }

  try {
    const result = await prisma.financialTransaction.aggregate({
      where: { userId: session.userId },
      _min: { date: true },
      _max: { date: true },
      _count: true,
    });

    if (!result._min.date || !result._max.date) {
      return NextResponse.json({ months: [], totalTransactions: 0 }, {
        headers: HEADERS,
      });
    }

    // Generate all months between min and max date
    const months: string[] = [];
    const [startY, startM] = result._min.date.slice(0, 7).split("-").map(Number);
    const [endY, endM] = result._max.date.slice(0, 7).split("-").map(Number);

    let y = startY;
    let m = startM;
    while (y < endY || (y === endY && m <= endM)) {
      months.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) { m = 1; y++; }
    }

    return NextResponse.json({
      months,
      totalTransactions: result._count,
      firstDate: result._min.date,
      lastDate: result._max.date,
    }, {
      headers: HEADERS,
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: "financeiro_range" } });
    return NextResponse.json({ error: "Erro interno" }, { status: 500, headers: HEADERS });
  }
}
