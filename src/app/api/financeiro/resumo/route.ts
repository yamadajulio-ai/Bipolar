import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { localDateStr } from "@/lib/dateUtils";

function getMonthRange(month: string): { gte: string; lte: string } {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { gte: `${month}-01`, lte: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function getPrevMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 2, 1); // month-2 because JS months are 0-indexed
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM
  let dateFilter: { gte: string; lte?: string };
  let prevMonthFilter: { gte: string; lte: string } | null = null;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    dateFilter = getMonthRange(month);
    prevMonthFilter = getMonthRange(getPrevMonth(month));
  } else {
    const days = parseInt(searchParams.get("days") || "30");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    dateFilter = { gte: localDateStr(cutoff) };
  }

  // Fetch current + previous month transactions in parallel
  const [transactions, prevTransactions, diaryEntries] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: { userId: session.userId, date: dateFilter },
    }),
    prevMonthFilter
      ? prisma.financialTransaction.findMany({
          where: { userId: session.userId, date: prevMonthFilter },
        })
      : Promise.resolve([]),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: dateFilter },
      select: { date: true, mood: true, energyLevel: true },
    }),
  ]);

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
    ? round2(totalExpense / uniqueDays.size)
    : 0;

  // Previous month totals for comparison
  let prevIncome = 0;
  let prevExpense = 0;
  for (const tx of prevTransactions) {
    if (tx.amount > 0) prevIncome += tx.amount;
    else prevExpense += Math.abs(tx.amount);
  }

  const comparison = prevMonthFilter
    ? {
        prevIncome: round2(prevIncome),
        prevExpense: round2(prevExpense),
        incomeChange: prevIncome > 0 ? round2(((totalIncome - prevIncome) / prevIncome) * 100) : null,
        expenseChange: prevExpense > 0 ? round2(((totalExpense - prevExpense) / prevExpense) * 100) : null,
      }
    : null;

  // Mood-spending correlation
  const diaryMap = new Map(diaryEntries.map((e) => [e.date, e]));

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
        spending: round2(spending),
        mood: diary?.mood ?? null,
        energy: diary?.energyLevel ?? null,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Spending alerts: days with high spending + high mood (mania indicator)
  const avgDailySpending = dailyAverage || 1;
  const spendingAlerts = moodCorrelation
    .filter((d) => d.mood !== null && d.mood >= 4 && d.spending > avgDailySpending * 1.5)
    .map((d) => ({
      date: d.date,
      spending: d.spending,
      mood: d.mood!,
      message: `Gasto de R$ ${d.spending.toFixed(2)} com humor elevado (${d.mood}/5)`,
    }));

  // Category breakdown sorted by absolute value
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  // Daily spending trend (for line chart)
  const spendingTrend = Object.entries(dailySpending)
    .map(([date, spending]) => ({ date, spending: round2(spending) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    balance: round2(totalIncome - totalExpense),
    dailyAverage,
    transactionCount: transactions.length,
    comparison,
    categoryBreakdown,
    moodCorrelation,
    spendingAlerts,
    spendingTrend,
  });
}
