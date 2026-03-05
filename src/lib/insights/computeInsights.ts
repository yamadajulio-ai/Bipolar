import { WARNING_SIGNS } from "@/lib/constants";

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

export interface PlannerBlockInput {
  date: string;      // YYYY-MM-DD
  timeHHMM: string;  // HH:MM (extracted from startAt)
  category: string;
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
  midpoint: string | null;
  midpointTrend: TrendDirection | null;
  midpointDelta: number | null;
  durationVariability: number | null;
  durationVariabilityColor: StatusColor | null;
  recordCount: number;
  sleepHeadline: string | null;
  alerts: ClinicalAlert[];
}

export interface MoodInsights {
  moodTrend: TrendDirection | null;
  moodAmplitude: number | null;           // max-min in last 7d
  moodAmplitudeLabel: string | null;      // "Baixa"/"Moderada"/"Alta"
  medicationAdherence: number | null;
  medicationResponseRate: string | null;  // "X/Y dias"
  topWarningSigns: { key: string; label: string; count: number }[];
  moodHeadline: string | null;
  alerts: ClinicalAlert[];
}

export interface AnchorData {
  variance: number | null;
  regularityScore: number | null;         // 0-100
  color: StatusColor | null;
  label: string;
  source: "manual" | "planner" | "sleep" | null;
  daysCount: number;
}

export interface RhythmInsights {
  hasEnoughData: boolean;
  overallRegularity: number | null;
  anchors: Record<string, AnchorData>;
  usedSleepFallback: boolean;
  usedPlannerFallback: boolean;
  alerts: ClinicalAlert[];
}

export interface ChartInsights {
  chartData: { date: string; mood: number; sleepHours: number; energy: number | null }[];
  correlationNote: string | null;
  lagCorrelationNote: string | null;
}

export interface CombinedPattern {
  variant: "info" | "warning" | "danger";
  title: string;
  message: string;
}

export interface RiskScore {
  score: number;
  level: "ok" | "atencao" | "atencao_alta";
  factors: string[];
}

export interface InsightsResult {
  sleep: SleepInsights;
  mood: MoodInsights;
  rhythm: RhythmInsights;
  chart: ChartInsights;
  combinedPatterns: CombinedPattern[];
  risk: RiskScore | null;
}

// ── Helpers ─────────────────────────────────────────────────

function timeToMinutes(time: string): number | null {
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Normalize bedtime minutes so post-midnight (00:00-11:59) becomes +1440. */
function normalizeBedtime(mins: number): number {
  return mins < 720 ? mins + 1440 : mins;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Sample standard deviation (n-1 denominator for small samples). */
function computeStdDev(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.round(Math.sqrt(variance));
}

export function formatSleepDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function minutesToTime(mins: number): string {
  const total = Math.round(((mins % 1440) + 1440) % 1440); // integer 0..1439
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pearson correlation on values (used internally for Spearman). */
function pearsonCorrelation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return num / denom;
}

/** Assign fractional ranks (handles ties correctly via averaging). */
function assignRanks(arr: number[]): number[] {
  const n = arr.length;
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].v === indexed[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation — Pearson on ranks, correct with ties. */
function spearmanCorrelation(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 14) return null;
  return pearsonCorrelation(assignRanks(x), assignRanks(y));
}

/** Check if two YYYY-MM-DD dates are exactly 1 day apart. */
function isNextDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + "T12:00:00Z");
  const b = new Date(dateB + "T12:00:00Z");
  const diffMs = b.getTime() - a.getTime();
  return diffMs >= 23 * 3600000 && diffMs <= 25 * 3600000;
}

/** Generic streak counter: counts max consecutive days matching predicate. */
function longestStreak<T extends { date: string }>(
  sorted: T[],
  predicate: (item: T) => boolean,
): number {
  let max = 0;
  let cur = 0;
  let prevDate: string | null = null;

  for (const item of sorted) {
    const consecutive = prevDate !== null && isNextDay(prevDate, item.date);
    if (!consecutive) cur = 0;

    if (predicate(item)) {
      cur++;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
    prevDate = item.date;
  }
  return max;
}

/** Current streak ending at the last element — for active alerts. */
function currentStreak<T extends { date: string }>(
  sorted: T[],
  predicate: (item: T) => boolean,
): number {
  let cur = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!predicate(sorted[i])) break;
    if (i < sorted.length - 1 && !isNextDay(sorted[i].date, sorted[i + 1].date)) break;
    cur++;
  }
  return cur;
}

function dateStr(d: Date, tz: string): string {
  const parts = d.toLocaleDateString("sv-SE", { timeZone: tz }).split("-");
  return parts.join("-");
}

// ── Sleep Insights ──────────────────────────────────────────

function findConsecutiveShortNights(sorted: SleepLogInput[], threshold: number): number {
  return longestStreak(sorted, (log) => log.totalHours < threshold);
}

function computeSleepInsights(sleepLogs: SleepLogInput[], today: Date, tz: string): SleepInsights {
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
  const bedtimeMinutes = sorted
    .map((s) => timeToMinutes(s.bedtime))
    .filter((v): v is number => v !== null)
    .map((v) => normalizeBedtime(v));
  const bedtimeVariance = computeStdDev(bedtimeMinutes);

  const bedtimeVarianceColor: StatusColor | null = bedtimeVariance === null ? null
    : bedtimeVariance <= 30 ? "green"
    : bedtimeVariance <= 60 ? "yellow"
    : "red";

  // 3. Sleep trend: last 7d (including today) vs previous 7d
  const sevenAgo = new Date(today); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const fourteenAgo = new Date(today); fourteenAgo.setDate(fourteenAgo.getDate() - 13);
  const str7 = dateStr(sevenAgo, tz);
  const str14 = dateStr(fourteenAgo, tz);

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

  // 5. Sleep midpoint (circadian phase marker)
  let midpoint: string | null = null;
  let midpointTrend: TrendDirection | null = null;
  let midpointDelta: number | null = null;

  if (recordCount >= 3) {
    const midpoints = sorted
      .map((s) => {
        const btMin = timeToMinutes(s.bedtime);
        if (btMin === null) return null;
        return normalizeBedtime(btMin) + (s.totalHours * 60) / 2;
      })
      .filter((v): v is number => v !== null);

    if (midpoints.length >= 3) {
      const avgMid = midpoints.reduce((a, b) => a + b, 0) / midpoints.length;
      midpoint = minutesToTime(avgMid);
    }

    const mid7 = sorted.filter((s) => s.date >= str7).map((s) => {
      const btMin = timeToMinutes(s.bedtime);
      if (btMin === null) return null;
      return normalizeBedtime(btMin) + (s.totalHours * 60) / 2;
    }).filter((v): v is number => v !== null);
    const midPrev = sorted.filter((s) => s.date >= str14 && s.date < str7).map((s) => {
      const btMin = timeToMinutes(s.bedtime);
      if (btMin === null) return null;
      return normalizeBedtime(btMin) + (s.totalHours * 60) / 2;
    }).filter((v): v is number => v !== null);

    if (mid7.length >= 3 && midPrev.length >= 3) {
      const avgMid7 = mid7.reduce((a, b) => a + b, 0) / mid7.length;
      const avgMidPrev = midPrev.reduce((a, b) => a + b, 0) / midPrev.length;
      midpointDelta = Math.round(avgMid7 - avgMidPrev);
      if (midpointDelta > 30) midpointTrend = "up";
      else if (midpointDelta < -30) midpointTrend = "down";
      else midpointTrend = "stable";
    }
  }

  // 6. Duration variability (night-to-night stddev)
  const durationMinutes = sorted.map((s) => s.totalHours * 60);
  const durationVariability = computeStdDev(durationMinutes);
  const durationVariabilityColor: StatusColor | null = durationVariability === null ? null
    : durationVariability <= 30 ? "green"
    : durationVariability <= 60 ? "yellow"
    : "red";

  // 7. Clinical alerts
  const alerts: ClinicalAlert[] = [];

  // Use currentStreak (active state) for alerts, not longestStreak (historical max)
  const consecutiveShortNow = currentStreak(sorted, (log) => log.totalHours < 6);
  if (consecutiveShortNow >= 2) {
    alerts.push({
      variant: "warning",
      title: "Noites curtas consecutivas",
      message: `Você dormiu menos de 6 horas por ${consecutiveShortNow} noites seguidas. `
        + `Reduções persistentes de sono são um padrão que merece atenção. `
        + `Considere conversar com seu profissional de saúde sobre isso.`,
    });
  }

  // Baseline deviation alerts (vs personal median — robust against outliers)
  const baselineMedian = median(sorted.map((s) => s.totalHours));
  if (baselineMedian !== null && last7.length >= 3) {
    const avgLast7 = last7.reduce((s, l) => s + l.totalHours, 0) / last7.length;
    const deviationMin = Math.round((avgLast7 - baselineMedian) * 60);

    if (deviationMin <= -60) {
      alerts.push({
        variant: "warning",
        title: "Sono abaixo do seu padrão",
        message: `Sua média dos últimos 7 dias está ${Math.abs(deviationMin)} minutos abaixo da sua mediana de 30 dias. `
          + `Mudanças significativas no sono merecem atenção, especialmente se combinadas com outros sinais.`,
      });
    }
    if (deviationMin >= 60) {
      alerts.push({
        variant: "info",
        title: "Sono acima do seu padrão",
        message: `Sua média dos últimos 7 dias está ${deviationMin} minutos acima da sua mediana de 30 dias. `
          + `Observe se está sentindo menos energia ou motivação.`,
      });
    }
  }

  if (bedtimeVariance !== null && bedtimeVariance > 90) {
    alerts.push({
      variant: "warning",
      title: "Irregularidade circadiana",
      message: `A variação do seu horário de dormir está em ±${bedtimeVariance} minutos. `
        + `Manter horários regulares de sono ajuda na estabilidade do humor. `
        + `A meta recomendada é manter variação menor que 30 minutos.`,
    });
  }

  if (midpointTrend !== "stable" && midpointDelta !== null && Math.abs(midpointDelta) > 45) {
    const direction = midpointDelta > 0 ? "atrasou" : "adiantou";
    alerts.push({
      variant: "info",
      title: `Ponto médio do sono ${midpointDelta > 0 ? "atrasando" : "adiantando"}`,
      message: `Seu ponto médio de sono ${direction} ${Math.abs(midpointDelta)} minutos na última semana. `
        + `Mudanças no ritmo circadiano são um padrão que vale acompanhar com seu profissional.`,
    });
  }

  // 8. Interpretive headline
  let sleepHeadline: string | null = null;
  if (recordCount >= 7) {
    const issues: string[] = [];
    if (avgDuration !== null && avgDuration < 6) issues.push("duração abaixo do ideal");
    if (bedtimeVariance !== null && bedtimeVariance > 60) issues.push("horários irregulares");
    if (durationVariability !== null && durationVariability > 60) issues.push("duração instável");
    if (consecutiveShortNow >= 2) issues.push(`${consecutiveShortNow} noites curtas seguidas`);

    if (issues.length === 0) {
      sleepHeadline = "Seu sono está dentro dos parâmetros esperados.";
    } else {
      sleepHeadline = `Atenção: ${issues.join(", ")}.`;
    }
  }

  return {
    avgDuration, avgDurationColor, bedtimeVariance, bedtimeVarianceColor,
    sleepTrend, sleepTrendDelta, avgQuality,
    midpoint, midpointTrend, midpointDelta,
    durationVariability, durationVariabilityColor,
    recordCount, sleepHeadline, alerts,
  };
}

// ── Mood Insights ───────────────────────────────────────────

function computeMoodInsights(entries: DiaryEntryInput[], today: Date, tz: string): MoodInsights {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Last 7 calendar days including today (not last 7 check-ins)
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const last7 = sorted.filter((e) => e.date >= str7);

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

  // 2. Mood variability — use amplitude (max-min) instead of stddev
  let moodAmplitude: number | null = null;
  let moodAmplitudeLabel: string | null = null;
  if (last7.length >= 3) {
    const moods = last7.map((e) => e.mood);
    moodAmplitude = Math.max(...moods) - Math.min(...moods);
    moodAmplitudeLabel = moodAmplitude <= 1 ? "Baixa"
      : moodAmplitude <= 2 ? "Moderada"
      : "Alta";
  }

  // 3. Medication adherence + response rate (denominator = 30 day window)
  const withMed = entries.filter((e) => e.tookMedication !== null);
  const medicationAdherence = withMed.length > 0
    ? Math.round((withMed.filter((e) => e.tookMedication === "sim").length / withMed.length) * 100)
    : null;
  const medicationResponseRate = entries.length > 0 ? `${withMed.length}/30 dias` : null;

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

  // 5. Clinical alerts — using currentStreak (active state, not historical max)
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

  // Low medication adherence
  if (medicationAdherence !== null && medicationAdherence < 80) {
    alerts.push({
      variant: "warning",
      title: "Adesão à medicação abaixo do ideal",
      message: `Sua adesão à medicação nos últimos 30 dias está em ${medicationAdherence}%. `
        + `A regularidade na medicação é um dos pilares para manter a estabilidade. `
        + `Converse com seu profissional de saúde se estiver com dificuldades.`,
    });
  }

  // Combined pattern: sono_reduzido + energia_excessiva
  const combinedPattern = entries.filter((e) => {
    if (!e.warningSigns) return false;
    try {
      const signs: string[] = JSON.parse(e.warningSigns);
      return signs.includes("sono_reduzido") && signs.includes("energia_excessiva");
    } catch { return false; }
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

  // 6. Interpretive headline
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
    topWarningSigns, moodHeadline, alerts,
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

/** Convert variance to regularity score 0-100. */
export function regularityScoreFromVariance(v: number): number {
  if (v <= 30) return 100;
  if (v >= 180) return 0;
  return Math.round(100 * (1 - (v - 30) / 150));
}

/** Build per-day maps from PlannerBlocks for IPSRT anchor inference. */
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

    const regularityScore = variance !== null ? regularityScoreFromVariance(variance) : null;

    anchors[field] = { variance, regularityScore, color, label: ANCHOR_LABELS[field], source, daysCount };
  }

  // Weighted average by daysCount (anchors with more data weigh more)
  const scored = Object.values(anchors).filter((a) => a.regularityScore !== null && a.daysCount > 0);
  const totalDays = scored.reduce((s, a) => s + a.daysCount, 0);
  const overallRegularity = totalDays > 0
    ? Math.round(scored.reduce((s, a) => s + a.regularityScore! * a.daysCount, 0) / totalDays)
    : null;

  const hasEnoughData = Object.values(anchors).some((a) => a.variance !== null);

  const alerts: ClinicalAlert[] = [];
  if (overallRegularity !== null && overallRegularity < 40) {
    alerts.push({
      variant: "info",
      title: "Ritmo social irregular",
      message: `Sua regularidade geral está em ${overallRegularity}%. Manter horários regulares `
        + `para atividades-chave ajuda na estabilidade do humor. `
        + `Comece estabilizando uma âncora por vez — pequenas mudanças fazem diferença.`,
    });
  }

  return { hasEnoughData, overallRegularity, anchors, usedSleepFallback, usedPlannerFallback, alerts };
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

  // Sanitize: filter out sleep=0 (likely "skip") and unrealistic values
  const validPairs = chartData.filter((d) => d.sleepHours >= 1 && d.sleepHours <= 14);

  let correlationNote: string | null = null;
  if (validPairs.length >= 14) {
    const r = spearmanCorrelation(validPairs.map((d) => d.sleepHours), validPairs.map((d) => d.mood));
    if (r !== null) {
      const caveat = ` (n=${validPairs.length}, converse com seu profissional para interpretar)`;
      if (r > 0.4) {
        correlationNote = "Seus dados sugerem uma associação positiva entre sono e humor: "
          + "nos dias que você dorme mais, seu humor tende a ser melhor." + caveat;
      } else if (r < -0.4) {
        correlationNote = "Seus dados sugerem uma associação inversa entre sono e humor: "
          + "nos dias que você dorme mais, seu humor tende a ser mais baixo." + caveat;
      }
    }
  }

  // Lag-1 correlation: sleep(day N) → mood(day N+1) — sanitized
  let lagCorrelationNote: string | null = null;
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
      const rLag = spearmanCorrelation(lagSleep, lagMood);
      if (rLag !== null) {
        const caveat = ` (n=${lagSleep.length}, converse com seu profissional para interpretar)`;
        if (rLag > 0.4) {
          lagCorrelationNote = "Padrão observado: quando você dorme mais, seu humor no dia seguinte tende a ser melhor." + caveat;
        } else if (rLag < -0.4) {
          lagCorrelationNote = "Padrão observado: quando você dorme mais, seu humor no dia seguinte tende a ser mais baixo." + caveat;
        }
      }
    }
  }

  return { chartData, correlationNote, lagCorrelationNote };
}

// ── Combined Patterns ───────────────────────────────────────

function computeCombinedPatterns(
  sleepLogs: SleepLogInput[],
  entries: DiaryEntryInput[],
): CombinedPattern[] {
  const patterns: CombinedPattern[] = [];

  // Pattern 1: Sleep reduction + elevated energy + elevated mood
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

  // Pattern 2: Increased sleep + low mood + isolation
  if (avgSleep !== null) {
    const hypersomniaMood = entries.filter((e) => {
      const sleep = sleepByDate.get(e.date);
      if (sleep === undefined || sleep < avgSleep + 1) return false;
      if (e.mood > 2) return false;
      if (!e.warningSigns) return false;
      try {
        const signs: string[] = JSON.parse(e.warningSigns);
        return signs.includes("isolamento");
      } catch { return false; }
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

// ── Risk Heuristic Score ────────────────────────────────────

function computeRiskScore(
  sleep: SleepInsights,
  mood: MoodInsights,
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): RiskScore | null {
  if (sleep.recordCount < 7 || entries.length < 7) return null;

  let score = 0;
  const factors: string[] = [];

  // Sleep duration significantly below baseline
  if (sleep.avgDuration !== null && sleep.sleepTrendDelta !== null && sleep.sleepTrendDelta < -1) {
    score += 2;
    factors.push("Sono caiu >1h vs média");
  }

  // High bedtime variance
  if (sleep.bedtimeVariance !== null && sleep.bedtimeVariance > 90) {
    score += 1;
    factors.push("Variação horário >90min");
  }

  // Consecutive short nights — use currentStreak (active state)
  const sortedSleep = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date));
  const shortNow = currentStreak(sortedSleep, (s) => s.totalHours < 6);
  if (shortNow >= 3) {
    score += 2;
    factors.push(`${shortNow} noites curtas seguidas`);
  }

  // Mood streaks — use currentStreak (active state)
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

  // Key warning signs (calendar-based last 7 days)
  const recentSigns = new Set<string>();
  for (const e of last7Entries) {
    if (!e.warningSigns) continue;
    try {
      const signs: string[] = JSON.parse(e.warningSigns);
      for (const s of signs) recentSigns.add(s);
    } catch { /* ignore */ }
  }
  const riskSigns = ["pensamentos_acelerados", "gastos_impulsivos", "energia_excessiva", "planos_grandiosos"];
  const matchedSigns = riskSigns.filter((s) => recentSigns.has(s));
  if (matchedSigns.length >= 2) {
    score += 1;
    factors.push("Sinais de alerta ativos");
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

// ── Main Export ─────────────────────────────────────────────

export function computeInsights(
  sleepLogs: SleepLogInput[],
  entries: DiaryEntryInput[],
  rhythms: DailyRhythmInput[],
  plannerBlocks?: PlannerBlockInput[],
  today: Date = new Date(),
  tz: string = "America/Sao_Paulo",
): InsightsResult {
  const sleep = computeSleepInsights(sleepLogs, today, tz);
  const mood = computeMoodInsights(entries, today, tz);
  const rhythm = computeRhythmInsights(rhythms, sleepLogs, plannerBlocks ?? []);
  const chart = computeChartInsights(entries, sleepLogs);
  const combinedPatterns = computeCombinedPatterns(sleepLogs, entries);
  const risk = computeRiskScore(sleep, mood, entries, sleepLogs, today, tz);

  return { sleep, mood, rhythm, chart, combinedPatterns, risk };
}
