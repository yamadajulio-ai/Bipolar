/**
 * computeInsights.ts — Barrel orchestrator
 *
 * Imports domain modules and re-exports the public API.
 * All existing callers (import { computeInsights } from "@/lib/insights/computeInsights")
 * continue to work without modification.
 */

import { WARNING_SIGNS } from "@/lib/constants";

// ── Re-export all types (public API) ────────────────────────
export type {
  SleepLogInput,
  DiaryEntryInput,
  DailyRhythmInput,
  PlannerBlockInput,
  FinancialTxInput,
  SpendingMoodChartPoint,
  SpendingMoodInsight,
  StatusColor,
  TrendDirection,
  ClinicalAlert,
  DataConfidence,
  SleepInsights,
  MoodInsights,
  AnchorData,
  RhythmInsights,
  CorrelationResult,
  ChartInsights,
  CombinedPattern,
  RiskScore,
  MoodThermometer,
  EpisodePrediction,
  CyclingAnalysis,
  SeasonalityAnalysis,
  HeatmapDay,
  InsightsResult,
  StabilityScore,
} from "./types";

// ── Re-export utility functions (public API) ────────────────
export { formatSleepDuration, regularityScoreFromVariance } from "./stats";

// ── Import domain modules ───────────────────────────────────
import type {
  SleepLogInput,
  DiaryEntryInput,
  DailyRhythmInput,
  PlannerBlockInput,
  FinancialTxInput,
  StatusColor,
  ClinicalAlert,
  AnchorData,
  RhythmInsights,
  ChartInsights,
  CombinedPattern,
  InsightsResult,
} from "./types";

import {
  timeToMinutes, normalizeBedtime, computeStdDev, median,
  dateStr, parseStringArray, isNextDay, currentStreak, isMainSleep, dayOffset,
  computeMADSigma, aggregateSleepByDay,
} from "./stats";
import { spearmanCorrelationLegacy, buildCorrelationResult } from "./correlations";
import { computeSleepInsights } from "./sleep";
import { computeRiskScore } from "./riskScore";
import { computeMoodThermometer } from "./moodThermometer";
import { computeEpisodePrediction } from "./episodePrediction";
import { computeCyclingAnalysis, computeSeasonalityAnalysis } from "./cycling";
import { computeHeatmapData } from "./heatmap";
import { computeStabilityScore } from "./stabilityScore";

// ── Mood Insights (kept inline — uses WARNING_SIGNS constant) ──

import type { MoodInsights, TrendDirection, CorrelationResult, DataConfidence } from "./types";

function computeMoodInsights(entries: DiaryEntryInput[], today: Date, tz: string): MoodInsights {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const last7 = sorted.filter((e) => e.date >= str7);

  const alerts: ClinicalAlert[] = [];

  let moodTrend: TrendDirection | null = null;
  if (last7.length >= 3) {
    const firstHalf = last7.slice(0, Math.ceil(last7.length / 2));
    const secondHalf = last7.slice(Math.ceil(last7.length / 2));
    const avgFirst = firstHalf.reduce((s, e) => s + e.mood, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, e) => s + e.mood, 0) / secondHalf.length;
    if (avgSecond - avgFirst > 0.4) moodTrend = "up";
    else if (avgFirst - avgSecond > 0.4) moodTrend = "down";
    else moodTrend = "stable";
  }

  let moodAmplitude: number | null = null;
  let moodAmplitudeLabel: string | null = null;
  if (last7.length >= 3) {
    const moods = last7.map((e) => e.mood);
    moodAmplitude = Math.max(...moods) - Math.min(...moods);
    moodAmplitudeLabel = moodAmplitude <= 1 ? "Baixa"
      : moodAmplitude <= 2 ? "Moderada"
      : "Alta";
  }

  // Only count definitive answers ("sim"/"nao") for adherence.
  // "nao_sei" (partial/pending doses) is excluded from the denominator
  // to avoid penalizing late-night medications not yet logged.
  const definiteMed = entries.filter((e) => e.tookMedication === "sim" || e.tookMedication === "nao");
  const medicationAdherence = definiteMed.length > 0
    ? Math.round((definiteMed.filter((e) => e.tookMedication === "sim").length / definiteMed.length) * 100)
    : null;
  const withMed = entries.filter((e) => e.tookMedication !== null);
  const medicationResponseRate = entries.length > 0 ? `${withMed.length}/30 dias` : null;

  const signCounts: Record<string, number> = {};
  for (const entry of last7) {
    const signs = parseStringArray(entry.warningSigns);
    for (const sign of signs) {
      signCounts[sign] = (signCounts[sign] || 0) + 1;
    }
  }
  const topWarningSigns = Object.entries(signCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const sign = WARNING_SIGNS.find((s) => s.key === key);
      return { key, label: sign?.label || key, count };
    });

  const upStreak = currentStreak(sorted, (e) => e.mood >= 4);
  if (upStreak >= 3) {
    alerts.push({
      variant: "warning",
      title: "Humor elevado persistente",
      message: `Seu humor está elevado (4 ou 5) há ${upStreak} dias consecutivos. `
        + `Humor persistentemente elevado é um padrão que vale observar. `
        + `Fique atento a mudanças no sono, impulsividade ou energia excessiva.`,
    });
  }

  const downStreak = currentStreak(sorted, (e) => e.mood <= 2);
  if (downStreak >= 3) {
    alerts.push({
      variant: "info",
      title: "Humor baixo persistente",
      message: `Seu humor está baixo (1 ou 2) há ${downStreak} dias consecutivos. `
        + `Fases depressivas frequentemente se instalam de forma gradual. `
        + `Manter sua rotina e atividades sociais, mesmo em pequenas doses, pode ajudar.`,
    });
  }

  if (medicationAdherence !== null && medicationAdherence < 80) {
    alerts.push({
      variant: "warning",
      title: "Adesão à medicação abaixo do ideal",
      message: `Sua adesão à medicação nos últimos 30 dias está em ${medicationAdherence}%. `
        + `A regularidade na medicação é um dos pilares para manter a estabilidade. `
        + `Converse com seu profissional de saúde se estiver com dificuldades.`,
    });
  }

  const combinedPattern = entries.filter((e) => {
    const signs = parseStringArray(e.warningSigns);
    return signs.includes("sono_reduzido") && signs.includes("energia_excessiva");
  });
  if (combinedPattern.length >= 2) {
    alerts.push({
      variant: "danger",
      title: "Padrão que merece atenção",
      message: `Você relatou "sono reduzido" e "energia excessiva" juntos em `
        + `${combinedPattern.length} dias nos últimos 30 dias. Esta combinação de sinais `
        + `é importante de acompanhar. Considere entrar em contato com seu profissional de saúde.`,
    });
  }

  let moodHeadline: string | null = null;
  if (last7.length >= 3) {
    const avgMood = last7.reduce((s, e) => s + e.mood, 0) / last7.length;
    if (avgMood >= 4 && upStreak >= 2) {
      moodHeadline = "Humor consistentemente elevado — observe sinais adicionais.";
    } else if (avgMood <= 2 && downStreak >= 2) {
      moodHeadline = "Humor em queda — priorize rotina e contato social.";
    } else if (moodAmplitude !== null && moodAmplitude >= 3) {
      moodHeadline = "Humor com alta oscilação esta semana.";
    } else {
      moodHeadline = "Humor dentro do esperado esta semana.";
    }
  }

  return {
    moodTrend, moodAmplitude, moodAmplitudeLabel,
    medicationAdherence, medicationResponseRate,
    topWarningSigns, moodHeadline, recordCount: entries.length, alerts,
  };
}

// ── Rhythm Insights (IPSRT) ─────────────────────────────────

const ANCHOR_FIELDS = ["wakeTime", "firstContact", "mainActivityStart", "dinnerTime", "bedtime"] as const;

const ANCHOR_LABELS: Record<string, string> = {
  wakeTime: "Horário de acordar",
  firstContact: "Primeiro contato social",
  mainActivityStart: "Atividade principal",
  dinnerTime: "Jantar",
  bedtime: "Horário de dormir",
};

import { regularityScoreFromVariance } from "./stats";

function buildPlannerMaps(blocks: PlannerBlockInput[]) {
  const socialByDay = new Map<string, number>();
  const workByDay = new Map<string, number>();
  const dinnerByDay = new Map<string, number>();

  for (const b of blocks) {
    const mins = timeToMinutes(b.timeHHMM);
    if (mins === null) continue;
    if (b.category === "social") {
      const prev = socialByDay.get(b.date);
      if (prev === undefined || mins < prev) socialByDay.set(b.date, mins);
    } else if (b.category === "trabalho") {
      const prev = workByDay.get(b.date);
      if (prev === undefined || mins < prev) workByDay.set(b.date, mins);
    } else if (b.category === "refeicao" && mins >= 1020) {
      const prev = dinnerByDay.get(b.date);
      if (prev === undefined || mins > prev) dinnerByDay.set(b.date, mins);
    }
  }

  return { socialByDay, workByDay, dinnerByDay };
}

function computeRhythmInsights(
  rhythms: DailyRhythmInput[],
  sleepLogs: SleepLogInput[],
  plannerBlocks: PlannerBlockInput[],
): RhythmInsights {
  const anchors: Record<string, AnchorData> = {};
  let usedSleepFallback = false;
  let usedPlannerFallback = false;

  const plannerMaps = buildPlannerMaps(plannerBlocks);

  const plannerFieldMap: Record<string, Map<string, number>> = {
    firstContact: plannerMaps.socialByDay,
    mainActivityStart: plannerMaps.workByDay,
    dinnerTime: plannerMaps.dinnerByDay,
  };

  for (const field of ANCHOR_FIELDS) {
    let source: "manual" | "planner" | "sleep" | null = null;
    let daysCount = 0;

    let values = rhythms
      .map((r) => r[field])
      .filter((v): v is string => v !== null)
      .map((v) => timeToMinutes(v))
      .filter((v): v is number => v !== null)
      .map((v) => field === "bedtime" ? normalizeBedtime(v) : v);

    if (values.length >= 3) {
      source = "manual";
      daysCount = values.length;
    }

    if (values.length < 3 && field in plannerFieldMap) {
      const dayMap = plannerFieldMap[field];
      const plannerValues = Array.from(dayMap.values());
      if (plannerValues.length >= 3) {
        values = plannerValues;
        source = "planner";
        daysCount = plannerValues.length;
        usedPlannerFallback = true;
      }
    }

    if (values.length < 3 && (field === "wakeTime" || field === "bedtime")) {
      const sleepField = field === "wakeTime" ? "wakeTime" : "bedtime";
      const fallback = sleepLogs
        .map((s) => timeToMinutes(s[sleepField]))
        .filter((v): v is number => v !== null)
        .map((v) => field === "bedtime" ? normalizeBedtime(v) : v);
      if (fallback.length >= 3) {
        values = fallback;
        source = "sleep";
        daysCount = fallback.length;
        usedSleepFallback = true;
      }
    }

    const variance = computeStdDev(values);
    const color: StatusColor | null = variance === null ? null
      : variance <= 30 ? "green"
      : variance <= 60 ? "yellow"
      : "red";

    const regScore = variance !== null ? regularityScoreFromVariance(variance) : null;

    let windowScore: number | null = null;
    if (values.length >= 3) {
      const med = median(values);
      if (med !== null) {
        const withinWindow = values.filter((v) => Math.abs(v - med) <= 45).length;
        windowScore = Math.round((withinWindow / values.length) * 100);
      }
    }

    anchors[field] = { variance, regularityScore: regScore, windowScore, color, label: ANCHOR_LABELS[field], source, daysCount };
  }

  const scored = Object.values(anchors).filter((a) => a.regularityScore !== null && a.daysCount > 0);
  const totalDays = scored.reduce((s, a) => s + a.daysCount, 0);
  const overallRegularity = totalDays > 0
    ? Math.round(scored.reduce((s, a) => s + a.regularityScore! * a.daysCount, 0) / totalDays)
    : null;

  const hasEnoughData = Object.values(anchors).some((a) => a.variance !== null);

  const rhythmAlerts: ClinicalAlert[] = [];
  if (overallRegularity !== null && overallRegularity < 40) {
    rhythmAlerts.push({
      variant: "info",
      title: "Ritmo social irregular",
      message: `Sua regularidade geral está em ${overallRegularity}%. Manter horários regulares `
        + `para atividades-chave ajuda na estabilidade do humor. `
        + `Comece estabilizando uma âncora por vez — pequenas mudanças fazem diferença.`,
    });
  }

  return { hasEnoughData, overallRegularity, anchors, usedSleepFallback, usedPlannerFallback, alerts: rhythmAlerts };
}

// ── Chart Insights ──────────────────────────────────────────

function computeChartInsights(entries: DiaryEntryInput[], sleepLogs: SleepLogInput[]): ChartInsights {
  const sleepByDate = new Map<string, number>();
  for (const log of sleepLogs) {
    sleepByDate.set(log.date, log.totalHours);
  }

  const chartData = entries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: sleepByDate.get(e.date) ?? e.sleepHours,
    energy: e.energyLevel,
  }));

  const validPairs = chartData.filter((d) => d.sleepHours >= 1 && d.sleepHours <= 14);

  let correlationNote: string | null = null;
  let corrResult: CorrelationResult | null = null;
  if (validPairs.length >= 14) {
    const r = spearmanCorrelationLegacy(validPairs.map((d) => d.sleepHours), validPairs.map((d) => d.mood));
    if (r !== null) {
      corrResult = buildCorrelationResult(r, validPairs.length);
      const caveat = ` (associação ${corrResult.strength}, n=${validPairs.length} — não prova causa)`;
      if (Math.abs(r) > 0.2) {
        correlationNote = r > 0
          ? "Seus dados sugerem uma associação entre dormir mais e humor melhor." + caveat
          : "Seus dados sugerem uma associação entre dormir mais e humor mais baixo." + caveat;
      }
    }
  }

  let lagCorrelationNote: string | null = null;
  let lagCorrResult: CorrelationResult | null = null;
  if (validPairs.length >= 15) {
    const sortedChart = [...validPairs].sort((a, b) => a.date.localeCompare(b.date));
    const lagSleep: number[] = [];
    const lagMood: number[] = [];
    for (let i = 0; i < sortedChart.length - 1; i++) {
      if (isNextDay(sortedChart[i].date, sortedChart[i + 1].date)) {
        lagSleep.push(sortedChart[i].sleepHours);
        lagMood.push(sortedChart[i + 1].mood);
      }
    }
    if (lagSleep.length >= 14) {
      const rLag = spearmanCorrelationLegacy(lagSleep, lagMood);
      if (rLag !== null) {
        lagCorrResult = buildCorrelationResult(rLag, lagSleep.length);
        const caveat = ` (associação ${lagCorrResult.strength}, n=${lagSleep.length} — não prova causa)`;
        if (Math.abs(rLag) > 0.2) {
          lagCorrelationNote = rLag > 0
            ? "Padrão observado: quando você dorme mais, seu humor no dia seguinte tende a ser melhor." + caveat
            : "Padrão observado: quando você dorme mais, seu humor no dia seguinte tende a ser mais baixo." + caveat;
        }
      }
    }
  }

  return { chartData, correlationNote, lagCorrelationNote, correlation: corrResult, lagCorrelation: lagCorrResult };
}

// ── Combined Patterns ───────────────────────────────────────

function computeCombinedPatterns(
  sleepLogs: SleepLogInput[],
  entries: DiaryEntryInput[],
): CombinedPattern[] {
  const patterns: CombinedPattern[] = [];

  const sleepByDate = new Map(sleepLogs.map((s) => [s.date, s.totalHours]));
  const avgSleep = sleepLogs.length > 0
    ? sleepLogs.reduce((s, l) => s + l.totalHours, 0) / sleepLogs.length
    : null;

  if (avgSleep !== null) {
    const highEnergyShortSleep = entries.filter((e) => {
      const sleep = sleepByDate.get(e.date);
      return sleep !== undefined && sleep < avgSleep - 1 && e.energyLevel !== null && e.energyLevel >= 4;
    });
    if (highEnergyShortSleep.length >= 2) {
      patterns.push({
        variant: "warning",
        title: "Sono reduzido + Energia alta",
        message: `Em ${highEnergyShortSleep.length} dias recentes você dormiu abaixo do seu padrão e relatou energia alta. `
          + `Essa combinação merece atenção e acompanhamento.`,
      });
    }
  }

  if (avgSleep !== null) {
    const hypersomniaMood = entries.filter((e) => {
      const sleep = sleepByDate.get(e.date);
      if (sleep === undefined || sleep < avgSleep + 1) return false;
      if (e.mood > 2) return false;
      return parseStringArray(e.warningSigns).includes("isolamento");
    });
    if (hypersomniaMood.length >= 2) {
      patterns.push({
        variant: "info",
        title: "Sono aumentado + Humor baixo + Isolamento",
        message: `Em ${hypersomniaMood.length} dias recentes você dormiu acima do padrão, relatou humor baixo e isolamento. `
          + `Manter rotina e contato social pode ajudar. Converse com seu profissional.`,
      });
    }
  }

  return patterns;
}

// ── Spending × Mood Insight ──────────────────────────────────

import type { SpendingMoodInsight, SpendingMoodChartPoint } from "./types";

function hasActivationWindow(
  spikeDate: string,
  allDates: string[],
  moodByDate: Record<string, number>,
  energyByDate: Record<string, number>,
  sleepByDate: Record<string, number>,
  avgSleep: number,
): { match: boolean; signals: Set<string> } {
  const idx = allDates.indexOf(spikeDate);
  const window = [spikeDate];
  if (idx > 0) window.push(allDates[idx - 1]);
  if (idx < allDates.length - 1) window.push(allDates[idx + 1]);
  const parts = spikeDate.split("-").map(Number);
  const spkDt = new Date(parts[0], parts[1] - 1, parts[2]);
  const prev = new Date(spkDt); prev.setDate(prev.getDate() - 1);
  const next = new Date(spkDt); next.setDate(next.getDate() + 1);
  const prevStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  if (!window.includes(prevStr)) window.push(prevStr);
  if (!window.includes(nextStr)) window.push(nextStr);

  const signals = new Set<string>();
  let signalCount = 0;
  const sleepThreshold = avgSleep - 1.5;

  for (const d of window) {
    if ((moodByDate[d] ?? 0) >= 4) { signals.add("humor"); signalCount++; }
    if ((energyByDate[d] ?? 0) >= 4) { signals.add("energia"); signalCount++; }
    if (d in sleepByDate && sleepByDate[d] < sleepThreshold) { signals.add("sono"); signalCount++; }
  }

  return { match: signalCount >= 2 || signals.has("humor"), signals };
}

function computeSpendingMoodInsight(
  financialTxs: FinancialTxInput[] | undefined,
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): SpendingMoodInsight {
  const CTA = "/financeiro?from=insights";
  const HIDDEN: SpendingMoodInsight = { state: "hidden", summary: "", chips: [], ctaHref: CTA };

  if (!financialTxs || financialTxs.length === 0) return HIDDEN;

  const dailyExp: Record<string, number> = {};
  const dailyTxCount: Record<string, number> = {};
  for (const tx of financialTxs) {
    if (tx.amount < 0) {
      const abs = Math.abs(tx.amount);
      dailyExp[tx.date] = (dailyExp[tx.date] ?? 0) + abs;
      dailyTxCount[tx.date] = (dailyTxCount[tx.date] ?? 0) + 1;
    }
  }

  // Filter recurring expenses
  const amountOccurrences: Record<number, number> = {};
  for (const tx of financialTxs) {
    if (tx.amount >= 0) continue;
    const rounded = Math.round(Math.abs(tx.amount));
    amountOccurrences[rounded] = (amountOccurrences[rounded] ?? 0) + 1;
  }
  const recurringAmounts = new Set<number>();
  const amountKeys = Object.keys(amountOccurrences).map(Number);
  for (const amt of amountKeys) {
    if (amountOccurrences[amt] >= 3) {
      recurringAmounts.add(amt);
    }
  }
  if (recurringAmounts.size > 0) {
    for (const tx of financialTxs) {
      if (tx.amount >= 0) continue;
      const rounded = Math.round(Math.abs(tx.amount));
      if (recurringAmounts.has(rounded)) {
        dailyExp[tx.date] = Math.max(0, (dailyExp[tx.date] ?? 0) - Math.abs(tx.amount));
        dailyTxCount[tx.date] = Math.max(0, (dailyTxCount[tx.date] ?? 0) - 1);
      }
    }
    for (const date of Object.keys(dailyExp)) {
      if (dailyExp[date] <= 0) {
        delete dailyExp[date];
        delete dailyTxCount[date];
      }
    }
  }

  const expDates = Object.keys(dailyExp).sort();
  if (expDates.length < 5) return HIDDEN;

  const moodByDate: Record<string, number> = {};
  const energyByDate: Record<string, number> = {};
  for (const e of entries) {
    moodByDate[e.date] = e.mood;
    if (e.energyLevel != null) energyByDate[e.date] = e.energyLevel;
  }
  const sleepByDate: Record<string, number> = {};
  for (const s of sleepLogs) {
    sleepByDate[s.date] = s.totalHours;
  }

  const sleepValues = Object.values(sleepByDate);
  const avgSleep = sleepValues.length > 0
    ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
    : 7;

  const overlapDays = expDates.filter((d) =>
    moodByDate[d] != null || energyByDate[d] != null || sleepByDate[d] != null
  );
  if (overlapDays.length < 5) {
    return {
      state: "learning",
      summary: "Ainda estamos aprendendo seu padrão de gastos. Quando houver mais dias registrados, vamos comparar melhor com seu humor.",
      chips: [`${expDates.length} dias com gastos`, `${overlapDays.length} com humor registrado`],
      ctaHref: CTA,
    };
  }

  // MAD z-score for spike detection — uses shared helper
  const values = expDates.map((d) => dailyExp[d]);
  const { median: medianVal, sigma } = computeMADSigma(values);

  const adaptiveFloor = Math.max(medianVal * 0.3, 20);

  // Frequency spike detection
  const txCounts = expDates.map((d) => dailyTxCount[d] ?? 0).filter((c) => c > 0);
  const sortedCounts = [...txCounts].sort((a, b) => a - b);
  const countMid = Math.floor(sortedCounts.length / 2);
  const medianTxCount = sortedCounts.length > 0
    ? (sortedCounts.length % 2 !== 0 ? sortedCounts[countMid] : (sortedCounts[countMid - 1] + sortedCounts[countMid]) / 2)
    : 1;
  const freqThreshold = Math.max(4, Math.ceil(medianTxCount * 2));

  const spikeDays: string[] = [];
  for (const date of expDates) {
    const delta = dailyExp[date] - medianVal;
    let isSpike = false;
    if (sigma > 0) {
      if (delta / sigma >= 2 && delta >= adaptiveFloor) {
        isSpike = true;
      }
    } else {
      if (delta > 0 && delta >= adaptiveFloor) {
        isSpike = true;
      }
    }
    if (!isSpike && (dailyTxCount[date] ?? 0) >= freqThreshold && delta > 0) {
      isSpike = true;
    }
    if (isSpike) spikeDays.push(date);
  }

  // Check convergence with ±1 day activation window
  interface SpikeCandidate {
    date: string;
    score: number;
    signals: Set<string>;
    claims: string[];
  }

  const sleepThreshold = avgSleep - 1.5;
  const candidates: SpikeCandidate[] = [];
  for (const d of spikeDays) {
    const result = hasActivationWindow(d, expDates, moodByDate, energyByDate, sleepByDate, avgSleep);
    if (!result.match) continue;

    const spkDt = new Date(d + "T12:00:00");
    const prevDt = new Date(spkDt); prevDt.setDate(prevDt.getDate() - 1);
    const nextDt = new Date(spkDt); nextDt.setDate(nextDt.getDate() + 1);
    const fmtD = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const windowDates: [string, number][] = [[d, 2], [fmtD(prevDt), 1], [fmtD(nextDt), 1]];

    let score = 0;
    const claims: string[] = [];
    for (const [wd, proximity] of windowDates) {
      if ((moodByDate[wd] ?? 0) >= 4) {
        score += proximity * 1.5;
        claims.push(`${wd}:humor`);
      }
      if ((energyByDate[wd] ?? 0) >= 4) {
        score += proximity;
        claims.push(`${wd}:energia`);
      }
      if (wd in sleepByDate && sleepByDate[wd] < sleepThreshold) {
        score += proximity;
        claims.push(`${wd}:sono`);
      }
    }

    candidates.push({ date: d, score, signals: result.signals, claims });
  }

  candidates.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));

  const allSignals = new Set<string>();
  const usedSignalDays = new Set<string>();
  const convergentDays: string[] = [];
  for (const cand of candidates) {
    const unclaimed = cand.claims.filter((k) => !usedSignalDays.has(k));
    const effectiveTypes = new Set(unclaimed.map((k) => k.split(":")[1]));
    const hasSameDayMood = unclaimed.includes(`${cand.date}:humor`);
    if (effectiveTypes.size >= 2 || hasSameDayMood) {
      unclaimed.forEach((k) => usedSignalDays.add(k));
      effectiveTypes.forEach((t) => allSignals.add(t));
      convergentDays.push(cand.date);
    }
  }
  convergentDays.sort();

  let state: SpendingMoodInsight["state"];
  if (spikeDays.length >= 2 && convergentDays.length >= 2) {
    state = "strong";
  } else if (spikeDays.length >= 1 && convergentDays.length >= 1) {
    state = "watch";
  } else {
    state = "noSignal";
  }

  let chartData: SpendingMoodChartPoint[] | undefined;
  if (state === "watch" || state === "strong") {
    chartData = [];
    for (let i = 0; i < 14; i++) {
      const d = dayOffset(today, i - 13, tz);
      const dateParts = d.split("-");
      chartData.push({
        date: `${dateParts[2]}/${dateParts[1]}`,
        expense: dailyExp[d] ?? 0,
        mood: moodByDate[d] ?? null,
        spike: spikeDays.includes(d),
      });
    }
  }

  const chips: string[] = [];
  if (spikeDays.length > 0) {
    chips.push(`${spikeDays.length} dia${spikeDays.length > 1 ? "s" : ""} acima do seu padrão`);
  }
  if (convergentDays.length > 0) {
    const signalParts: string[] = [];
    if (allSignals.has("humor")) signalParts.push("humor mais alto");
    if (allSignals.has("energia")) signalParts.push("mais energia");
    if (allSignals.has("sono")) signalParts.push("menos sono");
    const signalText = signalParts.length > 0 ? signalParts.join(", ") : "sinais de ativação";
    chips.push(`${convergentDays.length} coincidi${convergentDays.length > 1 ? "ram" : "u"} com ${signalText}`);
  }

  let summary: string;
  let helper: string | undefined;
  let srSummary: string;

  if (state === "noSignal") {
    summary = "Neste período, seus gastos não acompanharam mudanças de humor de forma consistente.";
    srSummary = `Nos últimos 30 dias, ${spikeDays.length} dia${spikeDays.length !== 1 ? "s" : ""} com gastos acima do padrão, sem associação clara com humor.`;
    return {
      state, summary, chips: chips.length > 0 ? chips : ["Sem padrão identificado"], ctaHref: CTA, srSummary,
    };
  }

  const signalParts: string[] = [];
  if (allSignals.has("humor")) signalParts.push("humor mais alto");
  if (allSignals.has("energia")) signalParts.push("mais energia");
  if (allSignals.has("sono")) signalParts.push("menos sono que o habitual");
  const signalPhrase = signalParts.length > 0
    ? signalParts.join(", ")
    : "sinais de ativação";

  if (state === "watch") {
    summary = `Em alguns dias, seus gastos subiram junto com ${signalPhrase}. Vale observar.`;
    helper = "Isso mostra uma associação nos seus registros, não uma conclusão sobre episódio.";
  } else {
    summary = `Nos seus registros recentes, houve mais de uma coincidência entre gastos acima do seu padrão e ${signalPhrase}. Isso merece acompanhamento.`;
    helper = "Este insight mostra uma associação nos seus registros. Não indica causa nem substitui avaliação clínica.";
  }

  srSummary = `Nos últimos 30 dias, houve ${spikeDays.length} dia${spikeDays.length !== 1 ? "s" : ""} com gastos acima do padrão; em ${convergentDays.length} deles houve ${signalPhrase}.`;

  return {
    state, summary, helper, chips, ctaHref: CTA, srSummary,
    chartRangeLabel: "Últimos 14 dias",
    chartData,
  };
}

// ── Main Export ─────────────────────────────────────────────

export function computeInsights(
  sleepLogs: SleepLogInput[],
  entries: DiaryEntryInput[],
  rhythms: DailyRhythmInput[],
  plannerBlocks?: PlannerBlockInput[],
  today: Date = new Date(),
  tz: string = "America/Sao_Paulo",
  entries90?: DiaryEntryInput[],
  sleepLogs90?: SleepLogInput[],
  financialTxs?: FinancialTxInput[],
): InsightsResult {
  const mainSleepLogs = aggregateSleepByDay(sleepLogs.filter((s) => isMainSleep(s)));

  const sleep = computeSleepInsights(mainSleepLogs, today, tz);
  const mood = computeMoodInsights(entries, today, tz);
  const rhythm = computeRhythmInsights(rhythms, sleepLogs, plannerBlocks ?? []);
  const chart = computeChartInsights(entries, sleepLogs);
  const combinedPatterns = computeCombinedPatterns(mainSleepLogs, entries);
  const risk = computeRiskScore(sleep, mood, entries, mainSleepLogs, today, tz, financialTxs);
  const thermometer = computeMoodThermometer(entries, mainSleepLogs, today, tz);

  // Mixed state risk boost
  if (risk && thermometer?.mixedFeatures) {
    if (thermometer.mixedStrength === "forte") {
      risk.score += 3;
      risk.factors.push("Estado misto forte (risco elevado)");
    } else if (thermometer.mixedStrength === "provavel") {
      risk.score += 2;
      risk.factors.push("Sinais mistos provável");
    }
    risk.level = risk.score <= 1 ? "ok" : risk.score <= 3 ? "atencao" : "atencao_alta";
  }

  const extEntries = entries90 ?? entries;
  const extSleep = sleepLogs90 ?? sleepLogs;
  const prediction = computeEpisodePrediction(entries, mainSleepLogs, sleep, thermometer, today, tz);
  const cycling = computeCyclingAnalysis(extEntries, today, tz);
  const seasonality = computeSeasonalityAnalysis(extEntries);
  const heatmap = computeHeatmapData(extEntries, extSleep, today, tz);

  const stability = computeStabilityScore(sleep, mood, risk, entries, mainSleepLogs);
  const spendingMood = computeSpendingMoodInsight(financialTxs, entries, mainSleepLogs, today, tz);

  return {
    sleep, mood, rhythm, chart, combinedPatterns, risk, thermometer,
    prediction, cycling, seasonality, heatmap, stability, spendingMood,
  };
}
