import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr } from "@/lib/dateUtils";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  let dateFilter: { gte: string; lte?: string };

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, mon] = month.split("-").map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    dateFilter = { gte: `${month}-01`, lte: `${month}-${String(lastDay).padStart(2, "0")}` };
  } else {
    const days = parseInt(searchParams.get("days") || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    dateFilter = { gte: localDateStr(cutoff) };
  }

  const transactions = await prisma.financialTransaction.findMany({
    where: { userId: session.userId, date: dateFilter },
  });

  // Compute totals
  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};
  const uniqueDays = new Set<string>();

  for (const tx of transactions) {
    if (tx.amount > 0) {
      totalIncome += tx.amount;
    } else {
      totalExpense += Math.abs(tx.amount);
    }

    if (!byCategory[tx.category]) byCategory[tx.category] = 0;
    byCategory[tx.category] += tx.amount;

    uniqueDays.add(tx.date);
  }

  const dailyAverage = uniqueDays.size > 0
    ? Math.round((totalExpense / uniqueDays.size) * 100) / 100
    : 0;

  // Mood-spending correlation: join with DiaryEntry
  const diaryEntries = await prisma.diaryEntry.findMany({
    where: { userId: session.userId, date: dateFilter },
    select: { date: true, mood: true, energyLevel: true },
  });

  const diaryMap = new Map(diaryEntries.map((e) => [e.date, e]));

  // Group spending by day for correlation
  const dailySpending: Record<string, number> = {};
  for (const tx of transactions) {
    if (!dailySpending[tx.date]) dailySpending[tx.date] = 0;
    dailySpending[tx.date] += Math.abs(tx.amount < 0 ? tx.amount : 0);
  }

  const moodCorrelation = Object.entries(dailySpending)
    .map(([date, spending]) => {
      const diary = diaryMap.get(date);
      return {
        date,
        spending: Math.round(spending * 100) / 100,
        mood: diary?.mood ?? null,
        energy: diary?.energyLevel ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Category breakdown sorted by absolute value
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  return NextResponse.json({
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    balance: Math.round((totalIncome - totalExpense) * 100) / 100,
    dailyAverage,
    transactionCount: transactions.length,
    categoryBreakdown,
    moodCorrelation,
  });
}
