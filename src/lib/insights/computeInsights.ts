import { WARNING_SIGNS } from "@/lib/constants";
import { localDateStr } from "@/lib/dateUtils";

// ── Input types (matching Prisma models) ────────────────────

interface SleepLogInput {
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
}

interface DiaryEntryInput {
  date: string;
  mood: number;
  sleepHours: number;
  energyLevel: number | null;
  anxietyLevel: number | null;
  irritability: number | null;
  tookMedication: string | null;
  warningSigns: string | null;
}

interface DailyRhythmInput {
  date: string;
  wakeTime: string | null;
  firstContact: string | null;
  mainActivityStart: string | null;
  dinnerTime: string | null;
  bedtime: string | null;
}

// ── Output types ────────────────────────────────────────────

type StatusColor = "green" | "yellow" | "red";
type TrendDirection = "up" | "down" | "stable";

export interface ClinicalAlert {
  variant: "info" | "warning" | "danger";
  title: string;
  message: string;
}

export interface SleepInsights {
  avgDuration: number | null;
  avgDurationColor: StatusColor | null;
  bedtimeVariance: number | null;
  bedtimeVarianceColor: StatusColor | null;
  sleepTrend: TrendDirection | null;
  sleepTrendDelta: number | null;
  avgQuality: number | null;
  recordCount: number;
  alerts: ClinicalAlert[];
}

export interface MoodInsights {
  moodTrend: TrendDirection | null;
  moodVariability: number | null;
  medicationAdherence: number | null;
  topWarningSigns: { key: string; label: string; count: number }[];
  alerts: ClinicalAlert[];
}

export interface AnchorData {
  variance: number | null;
  color: StatusColor | null;
  label: string;
}

export interface RhythmInsights {
  hasEnoughData: boolean;
  overallRegularity: number | null;
  anchors: Record<string, AnchorData>;
  usedSleepFallback: boolean;
  alerts: ClinicalAlert[];
}

export interface ChartInsights {
  chartData: { date: string; mood: number; sleepHours: number; energy: number | null }[];
  correlationNote: string | null;
}

export interface InsightsResult {
  sleep: SleepInsights;
  mood: MoodInsights;
  rhythm: RhythmInsights;
  chart: ChartInsights;
}

// ── Helpers ─────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Normalize bedtime minutes so post-midnight (00:00-05:59) becomes +1440. */
function normalizeBedtime(mins: number): number {
  return mins < 360 ? mins + 1440 : mins;
}

function computeStdDev(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

export function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function pearsonCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 5) return null;
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * y[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);
  const sumY2 = y.reduce((a, yi) => a + yi * yi, 0);
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return null;
  return (n * sumXY - sumX * sumY) / denom;
}

// ── Sleep Insights ──────────────────────────────────────────

function findConsecutiveShortNights(sorted: SleepLogInput[], threshold: number): number {
  let maxConsec = 0;
  let current = 0;
  for (const log of sorted) {
    if (log.totalHours < threshold) {
      current++;
      maxConsec = Math.max(maxConsec, current);
    } else {
      current = 0;
    }
  }
  return maxConsec;
}

function computeSleepInsights(sleepLogs: SleepLogInput[]): SleepInsights {
  const recordCount = sleepLogs.length;
  const sorted = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date));

  // 1. Average duration
  const avgDuration = recordCount > 0
    ? Math.round((sorted.reduce((s, l) => s + l.totalHours, 0) / recordCount) * 10) / 10
    : null;

  const avgDurationColor: StatusColor | null = avgDuration === null ? null
    : avgDuration >= 7 ? "green"
    : avgDuration >= 6 ? "yellow"
    : "red";

  // 2. Bedtime variance (with post-midnight fix)
  const bedtimeMinutes = sorted.map((s) => normalizeBedtime(timeToMinutes(s.bedtime)));
  const bedtimeVariance = computeStdDev(bedtimeMinutes);

  const bedtimeVarianceColor: StatusColor | null = bedtimeVariance === null ? null
    : bedtimeVariance <= 30 ? "green"
    : bedtimeVariance <= 60 ? "yellow"
    : "red";

  // 3. Sleep trend: last 7d vs previous 7d
  const now = new Date();
  const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
  const fourteenAgo = new Date(now); fourteenAgo.setDate(fourteenAgo.getDate() - 14);
  const str7 = localDateStr(sevenAgo);
  const str14 = localDateStr(fourteenAgo);

  const last7 = sorted.filter((s) => s.date >= str7);
  const prev7 = sorted.filter((s) => s.date >= str14 && s.date < str7);

  let sleepTrend: TrendDirection | null = null;
  let sleepTrendDelta: number | null = null;

  if (last7.length >= 3 && prev7.length >= 3) {
    const avgLast = last7.reduce((s, l) => s + l.totalHours, 0) / last7.length;
    const avgPrev = prev7.reduce((s, l) => s + l.totalHours, 0) / prev7.length;
    sleepTrendDelta = Math.round((avgLast - avgPrev) * 10) / 10;
    if (sleepTrendDelta > 0.3) sleepTrend = "up";
    else if (sleepTrendDelta < -0.3) sleepTrend = "down";
    else sleepTrend = "stable";
  }

  // 4. Average quality
  const qualityValues = sorted.filter((s) => s.quality > 0).map((s) => s.quality);
  const avgQuality = qualityValues.length > 0
    ? Math.round(qualityValues.reduce((s, v) => s + v, 0) / qualityValues.length)
    : null;

  // 5. Clinical alerts
  const alerts: ClinicalAlert[] = [];

  const consecutiveShort = findConsecutiveShortNights(sorted, 6);
  if (consecutiveShort >= 2) {
    alerts.push({
      variant: "warning",
      title: "Noites curtas consecutivas",
      message: `Você dormiu menos de 6 horas por ${consecutiveShort} noites seguidas. `
        + `Pesquisas do PROMAN/USP mostram que redução persistente do sono é um dos sinais `
        + `prodrômicos mais confiáveis de episódios de mania. Considere conversar com seu profissional de saúde.`,
    });
  }

  if (avgDuration !== null && last7.length >= 3) {
    const avgLast7 = last7.reduce((s, l) => s + l.totalHours, 0) / last7.length;
    const pctChange = ((avgLast7 - avgDuration) / avgDuration) * 100;
    if (pctChange <= -25) {
      alerts.push({
        variant: "warning",
        title: "Redução significativa do sono",
        message: `Sua média de sono dos últimos 7 dias caiu ${Math.abs(Math.round(pctChange))}% `
          + `em relação à sua média de 30 dias. No transtorno bipolar, reduções de sono acima de 25% `
          + `podem preceder episódios maníacos. Fique atento a outros sinais como energia excessiva.`,
      });
    }
    if (pctChange >= 25) {
      alerts.push({
        variant: "info",
        title: "Aumento significativo do sono",
        message: `Sua média de sono dos últimos 7 dias aumentou ${Math.round(pctChange)}% `
          + `em relação à sua média de 30 dias. Aumento do sono pode estar associado a fases `
          + `depressivas. Observe se está sentindo menos energia ou motivação.`,
      });
    }
  }

  if (bedtimeVariance !== null && bedtimeVariance > 90) {
    alerts.push({
      variant: "warning",
      title: "Irregularidade circadiana",
      message: `A variação do seu horário de dormir está em ±${bedtimeVariance} minutos. `
        + `Ritmos circadianos irregulares estão diretamente ligados à instabilidade do humor `
        + `no transtorno bipolar. A meta é manter variação menor que 30 minutos.`,
    });
  }

  return {
    avgDuration, avgDurationColor, bedtimeVariance, bedtimeVarianceColor,
    sleepTrend, sleepTrendDelta, avgQuality, recordCount, alerts,
  };
}

// ── Mood Insights ───────────────────────────────────────────

function computeMoodInsights(entries: DiaryEntryInput[]): MoodInsights {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const last7 = sorted.slice(-7);
  const alerts: ClinicalAlert[] = [];

  // 1. Mood trend
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

  // 2. Mood variability
  const moodValues = last7.map((e) => e.mood);
  const moodVariability = computeStdDev(moodValues);

  // 3. Medication adherence
  const withMed = entries.filter((e) => e.tookMedication !== null);
  const medicationAdherence = withMed.length > 0
    ? Math.round((withMed.filter((e) => e.tookMedication === "sim").length / withMed.length) * 100)
    : null;

  // 4. Top warning signs
  const signCounts: Record<string, number> = {};
  for (const entry of entries) {
    if (!entry.warningSigns) continue;
    try {
      const signs: string[] = JSON.parse(entry.warningSigns);
      for (const sign of signs) {
        signCounts[sign] = (signCounts[sign] || 0) + 1;
      }
    } catch { /* ignore */ }
  }
  const topWarningSigns = Object.entries(signCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => {
      const sign = WARNING_SIGNS.find((s) => s.key === key);
      return { key, label: sign?.label || key, count };
    });

  // 5. Clinical alerts

  // Elevated mood streak
  if (last7.length >= 3) {
    let upStreak = 0;
    for (let i = 1; i < last7.length; i++) {
      if (last7[i].mood >= 4 && last7[i].mood >= last7[i - 1].mood) {
        upStreak++;
      } else {
        upStreak = 0;
      }
    }
    if (upStreak >= 2) {
      alerts.push({
        variant: "warning",
        title: "Humor em elevação",
        message: `Seu humor está elevado (4 ou 5) há ${upStreak + 1} dias seguidos. `
          + `No transtorno bipolar, humor persistentemente elevado pode indicar o início `
          + `de um episódio hipomaníaco. Observe se há redução da necessidade de sono ou impulsividade.`,
      });
    }
  }

  // Low mood streak
  if (last7.length >= 3) {
    let downStreak = 0;
    for (let i = 1; i < last7.length; i++) {
      if (last7[i].mood <= 2 && last7[i].mood <= last7[i - 1].mood) {
        downStreak++;
      } else {
        downStreak = 0;
      }
    }
    if (downStreak >= 2) {
      alerts.push({
        variant: "info",
        title: "Humor em queda",
        message: `Seu humor está baixo (1 ou 2) há ${downStreak + 1} dias seguidos. `
          + `Fases depressivas frequentemente se instalam de forma gradual. `
          + `Manter sua rotina e atividades sociais, mesmo em pequenas doses, pode ajudar.`,
      });
    }
  }

  // Low medication adherence
  if (medicationAdherence !== null && medicationAdherence < 80) {
    alerts.push({
      variant: "warning",
      title: "Adesão à medicação abaixo do ideal",
      message: `Sua adesão à medicação nos últimos 30 dias está em ${medicationAdherence}%. `
        + `Estudos mostram que a adesão regular à medicação é o fator mais importante para prevenir `
        + `recaídas no transtorno bipolar.`,
    });
  }

  // Mania signature: sono_reduzido + energia_excessiva
  const maniaSignature = entries.filter((e) => {
    if (!e.warningSigns) return false;
    try {
      const signs: string[] = JSON.parse(e.warningSigns);
      return signs.includes("sono_reduzido") && signs.includes("energia_excessiva");
    } catch { return false; }
  });
  if (maniaSignature.length >= 2) {
    alerts.push({
      variant: "danger",
      title: "Padrão compatível com pródromo maníaco",
      message: `Você relatou "sono reduzido" e "energia excessiva" juntos em `
        + `${maniaSignature.length} dias nos últimos 30 dias. Esta combinação é uma das assinaturas `
        + `prodrômicas mais estudadas para episódios maníacos (DSM-5). `
        + `Considere entrar em contato com seu profissional de saúde.`,
    });
  }

  return { moodTrend, moodVariability, medicationAdherence, topWarningSigns, alerts };
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

function computeRhythmInsights(
  rhythms: DailyRhythmInput[],
  sleepLogs: SleepLogInput[],
): RhythmInsights {
  const anchors: Record<string, AnchorData> = {};
  let usedSleepFallback = false;

  for (const field of ANCHOR_FIELDS) {
    let values = rhythms
      .map((r) => r[field])
      .filter((v): v is string => v !== null)
      .map((v) => field === "bedtime" ? normalizeBedtime(timeToMinutes(v)) : timeToMinutes(v));

    // Fallback: use SleepLog for wake/bedtime when DailyRhythm is insufficient
    if (values.length < 3 && (field === "wakeTime" || field === "bedtime")) {
      const sleepField = field === "wakeTime" ? "wakeTime" : "bedtime";
      const fallback = sleepLogs.map((s) =>
        field === "bedtime"
          ? normalizeBedtime(timeToMinutes(s[sleepField]))
          : timeToMinutes(s[sleepField]),
      );
      if (fallback.length >= 3) {
        values = fallback;
        usedSleepFallback = true;
      }
    }

    const variance = computeStdDev(values);
    const color: StatusColor | null = variance === null ? null
      : variance <= 30 ? "green"
      : variance <= 60 ? "yellow"
      : "red";

    anchors[field] = { variance, color, label: ANCHOR_LABELS[field] };
  }

  // Overall regularity score (0-100)
  const regularities = Object.values(anchors)
    .filter((a) => a.variance !== null)
    .map((a) => {
      const v = a.variance!;
      if (v <= 30) return 100;
      if (v >= 180) return 0;
      return Math.round(100 * (1 - (v - 30) / 150));
    });

  const overallRegularity = regularities.length > 0
    ? Math.round(regularities.reduce((a, b) => a + b, 0) / regularities.length)
    : null;

  const hasEnoughData = Object.values(anchors).some((a) => a.variance !== null);

  const alerts: ClinicalAlert[] = [];
  if (overallRegularity !== null && overallRegularity < 40) {
    alerts.push({
      variant: "info",
      title: "Ritmo social irregular",
      message: `Sua regularidade geral está em ${overallRegularity}%. A Terapia de Ritmos Sociais (IPSRT) `
        + `mostra que manter horários regulares para atividades-chave reduz significativamente o risco `
        + `de episódios no transtorno bipolar. Comece estabilizando uma âncora por vez.`,
    });
  }

  return { hasEnoughData, overallRegularity, anchors, usedSleepFallback, alerts };
}

// ── Chart Insights ──────────────────────────────────────────

function computeChartInsights(entries: DiaryEntryInput[]): ChartInsights {
  const chartData = entries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: e.sleepHours,
    energy: e.energyLevel,
  }));

  let correlationNote: string | null = null;
  if (entries.length >= 7) {
    const r = pearsonCorrelation(
      entries.map((e) => e.sleepHours),
      entries.map((e) => e.mood),
    );
    if (r !== null) {
      if (r > 0.4) {
        correlationNote = "Seus dados mostram uma correlação positiva entre sono e humor: "
          + "nos dias que você dorme mais, seu humor tende a ser melhor.";
      } else if (r < -0.4) {
        correlationNote = "Seus dados mostram uma correlação inversa entre sono e humor: "
          + "nos dias que você dorme mais, seu humor tende a ser mais baixo. "
          + "Isso pode estar relacionado a fases depressivas.";
      }
    }
  }

  return { chartData, correlationNote };
}

// ── Main Export ─────────────────────────────────────────────

export function computeInsights(
  sleepLogs: SleepLogInput[],
  entries: DiaryEntryInput[],
  rhythms: DailyRhythmInput[],
): InsightsResult {
  return {
    sleep: computeSleepInsights(sleepLogs),
    mood: computeMoodInsights(entries),
    rhythm: computeRhythmInsights(rhythms, sleepLogs),
    chart: computeChartInsights(entries),
  };
}
