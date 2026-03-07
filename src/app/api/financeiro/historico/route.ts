import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // Last 12 months including current
  const now = new Date();
  const months: { month: string; gte: string; lte: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ms = `${y}-${String(m).padStart(2, "0")}`;
    const lastDay = new Date(y, m, 0).getDate();
    months.push({
      month: ms,
      gte: `${ms}-01`,
      lte: `${ms}-${String(lastDay).padStart(2, "0")}`,
    });
  }

  const transactions = await prisma.financialTransaction.findMany({
    where: {
      userId: session.userId,
      date: { gte: months[0].gte, lte: months[months.length - 1].lte },
    },
    select: { date: true, amount: true },
  });

  // Aggregate by month
  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (const m of months) {
    byMonth[m.month] = { income: 0, expense: 0 };
  }
  for (const tx of transactions) {
    const key = tx.date.slice(0, 7);
    if (byMonth[key]) {
      if (tx.amount > 0) byMonth[key].income += tx.amount;
      else byMonth[key].expense += Math.abs(tx.amount);
    }
  }

  const data = months.map((m) => ({
    month: m.month,
    label: new Date(m.month + "-15").toLocaleDateString("pt-BR", { month: "short" }),
    income: Math.round(byMonth[m.month].income * 100) / 100,
    expense: Math.round(byMonth[m.month].expense * 100) / 100,
  }));

  return NextResponse.json(data, { headers: HEADERS });
}
