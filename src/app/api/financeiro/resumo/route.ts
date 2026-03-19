import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";

// ── Helpers ─────────────────────────────────────────────────

function getMonthRange(month: string): { gte: string; lte: string } {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return { gte: `${month}-01`, lte: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function getPrevMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(year, mon - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Robust Statistics ───────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Median Absolute Deviation — robust spread measure. MAD * 1.4826 ≈ σ for normal data. */
function mad(arr: number[]): number {
  if (arr.length < 2) return 0;
  const med = median(arr);
  const deviations = arr.map((x) => Math.abs(x - med));
  return median(deviations);
}

/** Robust z-score using median + MAD instead of mean + stddev.
 *  When MAD=0 (all values equal or near-equal), falls back to
 *  relative delta with a minimum denominator to avoid hypersensitivity. */
const ABS_MIN_DENOM = 20; // R$20 floor to avoid tiny-median inflation
const SIGMA_EPS = 1e-6; // avoid absurd z-scores from tiny but nonzero sigma
function robustZScore(value: number, med: number, madValue: number): number {
  const sigma = madValue * 1.4826;
  if (sigma > SIGMA_EPS) return (value - med) / sigma;
  // MAD=0 fallback: use relative delta from median (with floor)
  const denom = Math.max(med, ABS_MIN_DENOM);
  const relDelta = (value - med) / denom;
  return relDelta > 0 ? relDelta * 3 : 0; // scale so 33%+ above median ≈ z=1
}

/** Assign ranks with tie correction for Spearman. */
function assignRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

/** Pearson correlation coefficient. */
function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 3) return null;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? null : num / den;
}

/** Spearman rank correlation — Pearson on ranks, correct with ties. */
function spearmanCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 7) return null;
  return pearsonCorrelation(assignRanks(x), assignRanks(y));
}

type DataConfidence = "alta" | "media" | "baixa";
type CorrelationStrength = "muito_fraca" | "fraca" | "moderada" | "forte";

interface CorrelationResult {
  rho: number;
  strength: CorrelationStrength;
  direction: "positiva" | "negativa";
  n: number;
  confidence: DataConfidence;
}

function buildCorrelationResult(rho: number, n: number): CorrelationResult {
  const absRho = Math.abs(rho);
  let strength: CorrelationStrength = absRho < 0.2 ? "muito_fraca"
    : absRho < 0.4 ? "fraca"
    : absRho < 0.6 ? "moderada"
    : "forte";
  // Cap strength for small samples — n<14 can't support "moderada"/"forte" claims
  if (n < 14 && (strength === "moderada" || strength === "forte")) {
    strength = "fraca";
  }
  const direction = rho >= 0 ? "positiva" as const : "negativa" as const;
  const confidence: DataConfidence = n >= 21 ? "alta" : n >= 14 ? "media" : "baixa";
  return { rho: round2(rho), strength, direction, n, confidence };
}

const HEADERS = { "Cache-Control": "no-store" };

// ── Main Handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // Rate limit: 60 resumo requests per minute per user
  const allowed = await checkRateLimit(`financeiro_resumo:${session.userId}`, 60, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em breve." }, { status: 429, headers: HEADERS });
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

  // Fetch current + previous month transactions + diary entries in parallel
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

  // ── Compute totals ────────────────────────────────────────
  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory: Record<string, number> = {};
  const dailySpending: Record<string, number> = {};
  const dailyTxCount: Record<string, number> = {};

  for (const tx of transactions) {
    if (tx.amount > 0) {
      totalIncome += tx.amount;
    } else {
      totalExpense += Math.abs(tx.amount);
    }

    if (!byCategory[tx.category]) byCategory[tx.category] = 0;
    byCategory[tx.category] += tx.amount;

    if (!dailySpending[tx.date]) dailySpending[tx.date] = 0;
    dailySpending[tx.date] += Math.abs(tx.amount < 0 ? tx.amount : 0);

    if (!dailyTxCount[tx.date]) dailyTxCount[tx.date] = 0;
    dailyTxCount[tx.date]++;
  }

  const spendingValues = Object.values(dailySpending);
  const uniqueDays = Object.keys(dailySpending).length;

  // ── Robust baseline (median + MAD) ────────────────────────
  const dailyMedian = round2(median(spendingValues));
  const dailyMAD = round2(mad(spendingValues));
  const dailyAverage = uniqueDays > 0 ? round2(totalExpense / uniqueDays) : 0;

  // Data confidence
  const dataConfidence: DataConfidence = uniqueDays >= 21 ? "alta" : uniqueDays >= 14 ? "media" : "baixa";

  // ── Previous month comparison ─────────────────────────────
  let prevIncome = 0;
  let prevExpense = 0;
  const prevByCategory: Record<string, number> = {};
  for (const tx of prevTransactions) {
    if (tx.amount > 0) prevIncome += tx.amount;
    else prevExpense += Math.abs(tx.amount);
    if (!prevByCategory[tx.category]) prevByCategory[tx.category] = 0;
    prevByCategory[tx.category] += tx.amount;
  }

  const comparison = prevMonthFilter
    ? {
        prevIncome: round2(prevIncome),
        prevExpense: round2(prevExpense),
        incomeChange: prevIncome > 0 ? round2(((totalIncome - prevIncome) / prevIncome) * 100) : null,
        expenseChange: prevExpense > 0 ? round2(((totalExpense - prevExpense) / prevExpense) * 100) : null,
      }
    : null;

  // ── Category change detection ─────────────────────────────
  // Categories with >=+60% delta that represent >=20% of total expense
  // Guards: require prev >= R$20 (avoid div-by-zero / tiny-base inflation)
  const MIN_PREV_FOR_CHANGE = 20;
  const categoryChanges: { category: string; current: number; previous: number; changePct: number }[] = [];
  if (prevMonthFilter && totalExpense > 0) {
    for (const [cat, total] of Object.entries(byCategory)) {
      if (total >= 0) continue; // only expenses
      const currentAbs = Math.abs(total);
      const prevAbs = Math.abs(prevByCategory[cat] || 0);
      if (prevAbs >= MIN_PREV_FOR_CHANGE) {
        const changePct = ((currentAbs - prevAbs) / prevAbs) * 100;
        const shareOfTotal = currentAbs / totalExpense;
        if (!Number.isFinite(changePct) || !Number.isFinite(shareOfTotal)) continue;
        if (changePct >= 60 && shareOfTotal >= 0.20) {
          categoryChanges.push({
            category: cat,
            current: round2(currentAbs),
            previous: round2(prevAbs),
            changePct: round2(changePct),
          });
        }
      }
    }
    categoryChanges.sort((a, b) => b.changePct - a.changePct);
  }

  // ── Mood-spending correlation (Spearman) ──────────────────
  const diaryMap = new Map(diaryEntries.map((e) => [e.date, e]));

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

  // Same-day correlation
  const validPairs = moodCorrelation.filter((d) => d.mood !== null && d.spending > 0);
  let sameDayCorrelation: CorrelationResult | null = null;
  if (validPairs.length >= 7) {
    const rho = spearmanCorrelation(
      validPairs.map((d) => d.spending),
      validPairs.map((d) => d.mood!),
    );
    if (rho !== null) {
      sameDayCorrelation = buildCorrelationResult(rho, validPairs.length);
    }
  }

  // Lag-1 correlation: spending(day N) → mood(day N+1)
  let lagCorrelation: CorrelationResult | null = null;
  const sortedDates = moodCorrelation.filter((d) => d.spending > 0);
  const lagPairs: { spending: number; mood: number }[] = [];
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const nextDate = sortedDates[i + 1];
    // Check if dates are consecutive
    const d1 = new Date(sortedDates[i].date + "T12:00:00Z");
    const d2 = new Date(nextDate.date + "T12:00:00Z");
    const diffMs = d2.getTime() - d1.getTime();
    if (diffMs >= 23 * 3600000 && diffMs <= 25 * 3600000 && nextDate.mood !== null) {
      lagPairs.push({ spending: sortedDates[i].spending, mood: nextDate.mood });
    }
  }
  if (lagPairs.length >= 7) {
    const rho = spearmanCorrelation(
      lagPairs.map((d) => d.spending),
      lagPairs.map((d) => d.mood),
    );
    if (rho !== null) {
      lagCorrelation = buildCorrelationResult(rho, lagPairs.length);
    }
  }

  // ── Anomaly detection (robust z-scores) ───────────────────
  const spendingAnomalies: {
    date: string;
    spending: number;
    zScore: number;
    mood: number | null;
    energy: number | null;
    type: "spending_spike" | "frequency_spike";
  }[] = [];

  if (spendingValues.length >= 5) {
    const med = median(spendingValues);
    const madVal = mad(spendingValues);
    const MIN_DELTA = 50; // absolute floor R$50

    for (const [date, spending] of Object.entries(dailySpending)) {
      const z = robustZScore(spending, med, madVal);
      const delta = spending - med;
      if (z >= 2 && delta >= MIN_DELTA) {
        const diary = diaryMap.get(date);
        spendingAnomalies.push({
          date,
          spending: round2(spending),
          zScore: round2(z),
          mood: diary?.mood ?? null,
          energy: diary?.energyLevel ?? null,
          type: "spending_spike",
        });
      }
    }

    // Frequency anomaly: days with unusually many transactions
    const txCounts = Object.values(dailyTxCount);
    if (txCounts.length >= 5) {
      const countMed = median(txCounts);
      const countMAD = mad(txCounts);
      for (const [date, count] of Object.entries(dailyTxCount)) {
        const z = robustZScore(count, countMed, countMAD);
        if (z >= 2 && count >= 5) {
          const diary = diaryMap.get(date);
          // Avoid duplicate if already flagged as spending spike
          if (!spendingAnomalies.some((a) => a.date === date)) {
            spendingAnomalies.push({
              date,
              spending: round2(dailySpending[date] || 0),
              zScore: round2(z),
              mood: diary?.mood ?? null,
              energy: diary?.energyLevel ?? null,
              type: "frequency_spike",
            });
          }
        }
      }
    }

    spendingAnomalies.sort((a, b) => b.zScore - a.zScore);
  }

  // ── Clinical spending alerts (high spending + high mood = mania) ──
  const spendingAlerts = moodCorrelation
    .filter((d) => d.mood !== null && d.mood >= 4 && d.spending > dailyMedian * 1.5)
    .map((d) => ({
      date: d.date,
      spending: d.spending,
      mood: d.mood!,
      message: `Gasto de R$ ${d.spending.toFixed(2)} com humor elevado (${d.mood}/5)`,
    }));

  // ── Category breakdown sorted by absolute value ───────────
  const categoryBreakdown = Object.entries(byCategory)
    .map(([category, total]) => ({ category, total: round2(total) }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  // ── Daily spending trend ──────────────────────────────────
  const spendingTrend = Object.entries(dailySpending)
    .map(([date, spending]) => ({ date, spending: round2(spending) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Night transaction detection (occurredAt between 00:00-05:59 America/Sao_Paulo) ──
  const nightTransactions = transactions.filter((tx) => {
    if (!tx.occurredAt) return false;
    const d = new Date(tx.occurredAt);
    if (!Number.isFinite(d.getTime())) return false; // invalid date guard
    const hourStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo",
    }).format(d);
    const hour = parseInt(hourStr, 10);
    return hour >= 0 && hour < 6;
  }).length;

  // ── Sustained increase alert (last 7d >= 1.8x baseline weekly total) ──
  // Build dense calendar series (fill zero-spend days) so weekly windows are accurate
  let sustainedIncrease: { totalLast7d: number; baseline7d: number; ratio: number } | null = null;
  if (dateFilter.lte) {
    // Month mode: build dense day series from gte to lte
    const denseDaily: [string, number][] = [];
    const startD = new Date(dateFilter.gte + "T12:00:00Z");
    const endD = new Date(dateFilter.lte + "T12:00:00Z");
    for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      denseDaily.push([key, dailySpending[key] || 0]);
    }
    if (denseDaily.length >= 14) {
      // Rolling 7-day weekly totals (prior days only)
      const priorDays = denseDaily.slice(0, -7);
      const weeklyTotals: number[] = [];
      for (let i = 0; i <= priorDays.length - 7; i++) {
        const weekSum = priorDays.slice(i, i + 7).reduce((s, [, v]) => s + v, 0);
        weeklyTotals.push(weekSum);
      }
      if (weeklyTotals.length >= 2) {
        const baselineWeekly = median(weeklyTotals);
        if (baselineWeekly > 0) {
          const last7 = denseDaily.slice(-7);
          const totalLast7d = round2(last7.reduce((s, [, v]) => s + v, 0));
          const baseline7d = round2(baselineWeekly);
          const ratio = round2(totalLast7d / baseline7d);
          if (ratio >= 1.8) {
            sustainedIncrease = { totalLast7d, baseline7d, ratio };
          }
        }
      }
    }
  }

  return NextResponse.json({
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    balance: round2(totalIncome - totalExpense),
    dailyAverage,
    dailyMedian,
    dailyMAD,
    dataConfidence,
    transactionCount: transactions.length,
    comparison,
    categoryBreakdown,
    categoryChanges,
    moodCorrelation,
    sameDayCorrelation,
    lagCorrelation,
    spendingAlerts,
    spendingAnomalies,
    spendingTrend,
    sustainedIncrease,
    nightTransactions,
  }, { headers: HEADERS });
}
