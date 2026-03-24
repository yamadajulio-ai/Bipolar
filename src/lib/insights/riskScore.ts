import type {
  SleepInsights, MoodInsights, DiaryEntryInput, SleepLogInput,
  FinancialTxInput, RiskScore,
} from "./types";
import { dateStr, currentStreak, parseStringArray, isMainSleep, computeMADSigma } from "./stats";

export function computeRiskScore(
  sleep: SleepInsights,
  mood: MoodInsights,
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
  financialTxs?: FinancialTxInput[],
): RiskScore | null {
  if (sleep.recordCount < 7 || entries.length < 7) return null;

  let score = 0;
  const factors: string[] = [];

  // Filter: exclude afternoon naps (< 4h, bedtime 12:00-19:59) and unreliable records (< 2h)
  const sortedSleep = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date));
  const mainSleep = sortedSleep.filter((s) => isMainSleep(s) && s.totalHours >= 2);

  // Require minimum data density
  const sevenAgoDt = new Date(today); sevenAgoDt.setDate(sevenAgoDt.getDate() - 6);
  const str7Sleep = dateStr(sevenAgoDt, tz);
  const recentMain = mainSleep.filter((s) => s.date >= str7Sleep);
  const hasSufficientSleepData = recentMain.length >= 4;

  if (hasSufficientSleepData) {
    if (sleep.avgDuration !== null && sleep.sleepTrendDelta !== null && sleep.sleepTrendDelta < -1) {
      score += 2;
      factors.push("Sono caiu >1h vs média");
    }

    if (sleep.bedtimeVariance !== null && sleep.bedtimeVariance > 90) {
      score += 1;
      factors.push("Variação horário >90min");
    }

    const shortNow = currentStreak(mainSleep, (s) => s.totalHours < 6);
    if (shortNow >= 4) {
      score += 2;
      factors.push(`${shortNow} noites curtas seguidas`);
    }
  }

  // Mood streaks
  const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const upNow = currentStreak(sortedEntries, (e) => e.mood >= 4);
  if (upNow >= 3) {
    score += 1;
    factors.push(`Humor ≥4 por ${upNow} dias`);
  }

  const downNow = currentStreak(sortedEntries, (e) => e.mood <= 2);
  if (downNow >= 3) {
    score += 1;
    factors.push(`Humor ≤2 por ${downNow} dias`);
  }

  // High energy — calendar-based last 7 days
  const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const last7Entries = sortedEntries.filter((e) => e.date >= str7);

  const highEnergy = last7Entries.filter((e) => e.energyLevel !== null && e.energyLevel >= 4).length;
  if (highEnergy >= 3) {
    score += 1;
    factors.push("Energia elevada frequente");
  }

  // Key warning signs
  const recentSigns = new Set<string>();
  for (const e of last7Entries) {
    for (const s of parseStringArray(e.warningSigns)) recentSigns.add(s);
  }
  const riskSigns = ["pensamentos_acelerados", "gastos_impulsivos", "energia_excessiva", "planos_grandiosos"];
  const matchedSigns = riskSigns.filter((s) => recentSigns.has(s));
  if (matchedSigns.length >= 2) {
    score += 1;
    factors.push("Sinais de alerta ativos");
  }

  // Financial spending spikes (DSM: "unrestrained buying sprees")
  if (financialTxs && financialTxs.length > 0) {
    const dailyExp: Record<string, number> = {};
    for (const tx of financialTxs) {
      if (tx.amount < 0) {
        if (!dailyExp[tx.date]) dailyExp[tx.date] = 0;
        dailyExp[tx.date] += Math.abs(tx.amount);
      }
    }
    const expValues = Object.values(dailyExp);
    if (expValues.length >= 5) {
      const { median: med, sigma } = computeMADSigma(expValues);

      // Check last 7 days for spending spikes
      const recentSpikes = Object.entries(dailyExp)
        .filter(([date, val]) => date >= str7 && sigma > 0 && (val - med) / sigma >= 2 && (val - med) >= 50);

      if (recentSpikes.length > 0) {
        score += 2;
        factors.push(`Gasto atípico em ${recentSpikes.length} dia(s) recente(s)`);

        const spikeWithContext = recentSpikes.some(([date]) => {
          const sleepDay = sortedSleep.find((s) => s.date === date);
          const entryDay = sortedEntries.find((e) => e.date === date);
          return (sleepDay && sleepDay.totalHours < 6) || (entryDay && entryDay.energyLevel !== null && entryDay.energyLevel >= 4);
        });
        if (spikeWithContext) {
          score += 1;
          factors.push("Gasto atípico + sono curto ou energia alta");
        }
      }
    }
  }

  // Good medication adherence reduces score
  if (mood.medicationAdherence !== null && mood.medicationAdherence >= 90) {
    score -= 1;
    factors.push("Boa adesão à medicação (protetor)");
  }

  score = Math.max(0, score);
  const level = score <= 1 ? "ok" as const
    : score <= 3 ? "atencao" as const
    : "atencao_alta" as const;

  return { score, level, factors };
}
