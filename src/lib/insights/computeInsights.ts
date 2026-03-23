import { WARNING_SIGNS } from "@/lib/constants";

// ── Input types (matching Prisma models) ────────────────────

interface SleepLogInput {
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
  hrv?: number | null;
  heartRate?: number | null;
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
  // Snapshot metadata (optional — absent for legacy entries)
  snapshotCount?: number;
  moodRange?: number | null;
  moodInstability?: number | null;
  anxietyPeak?: number | null;
  irritabilityPeak?: number | null;
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

export interface FinancialTxInput {
  date: string;   // YYYY-MM-DD
  amount: number; // negative = expense
}

// ── Spending × Mood Insight (for Insights page card) ──────────
export interface SpendingMoodChartPoint {
  date: string;      // DD/MM
  expense: number;   // absolute value
  mood: number | null;
  spike: boolean;
}

export interface SpendingMoodInsight {
  state: "hidden" | "learning" | "noSignal" | "watch" | "strong";
  summary: string;
  helper?: string;
  chips: string[];
  chartRangeLabel?: string;
  chartData?: SpendingMoodChartPoint[];
  ctaHref: string;
  /** Screen-reader summary */
  srSummary?: string;
}

// ── Output types ────────────────────────────────────────────

type StatusColor = "green" | "yellow" | "red";
type TrendDirection = "up" | "down" | "stable";

export interface ClinicalAlert {
  variant: "info" | "warning" | "danger";
  title: string;
  message: string;
}

export type DataConfidence = "baixa" | "media" | "alta";

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
  /** Social jet lag: midpoint difference weekday vs weekend (minutes) */
  socialJetLag: number | null;
  socialJetLagLabel: string | null;
  /** Data confidence based on record count + baseline availability */
  dataConfidence: DataConfidence;
}

export interface MoodInsights {
  moodTrend: TrendDirection | null;
  moodAmplitude: number | null;           // max-min in last 7d
  moodAmplitudeLabel: string | null;      // "Baixa"/"Moderada"/"Alta"
  medicationAdherence: number | null;
  medicationResponseRate: string | null;  // "X/Y dias"
  topWarningSigns: { key: string; label: string; count: number }[];
  moodHeadline: string | null;
  recordCount: number;                    // Total diary entries in period
  alerts: ClinicalAlert[];
}

export interface AnchorData {
  variance: number | null;
  regularityScore: number | null;         // 0-100 (variance-based)
  windowScore: number | null;             // 0-100 (SRM-like: % days within ±45min of median)
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

export interface CorrelationResult {
  rho: number;
  strength: "muito_fraca" | "fraca" | "moderada" | "forte";
  direction: "positiva" | "negativa";
  n: number;
  confidence: DataConfidence;
}

export interface ChartInsights {
  chartData: { date: string; mood: number; sleepHours: number; energy: number | null }[];
  correlationNote: string | null;
  lagCorrelationNote: string | null;
  /** Structured correlation data for better UI */
  correlation: CorrelationResult | null;
  lagCorrelation: CorrelationResult | null;
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

export interface MoodThermometer {
  /** 0-100 position: 0=depression, 50=euthymia, 100=mania */
  position: number;
  /** Raw mania-like score 0-100 */
  maniaScore: number;
  /** Raw depression-like score 0-100 */
  depressionScore: number;
  /** Zone label */
  zone: "depressao" | "depressao_leve" | "eutimia" | "hipomania" | "mania";
  /** Human-readable zone label */
  zoneLabel: string;
  /** Whether both M and D are elevated (mixed features) */
  mixedFeatures: boolean;
  /** Strength of mixed signal: forte = both high, provavel = pattern-based */
  mixedStrength: "forte" | "provavel" | null;
  /** Instability indicator based on mood amplitude */
  instability: "baixa" | "moderada" | "alta";
  /** Factors contributing to current position */
  factors: string[];
  /** Number of days of data used */
  daysUsed: number;
  /** Whether a personal sleep baseline was available for scoring */
  baselineAvailable: boolean;
}

// ── P2: Episode prediction ──────────────────────────────────

export interface EpisodePrediction {
  /** Probability estimate 0-100 that a mood episode (mania or depression) is developing */
  maniaRisk: number;
  depressionRisk: number;
  /** Which signals are driving each risk */
  maniaSignals: string[];
  depressionSignals: string[];
  /** Overall risk level */
  level: "baixo" | "moderado" | "elevado";
  /** Recommended actions */
  recommendations: string[];
  /** Days of data used */
  daysUsed: number;
}

// ── P2: Rapid cycling detection ──────────────────────────────

export interface CyclingAnalysis {
  /** Number of polarity switches in last 90 days */
  polaritySwitches: number;
  /** Whether rapid cycling pattern is detected (≥4 episodes/year pace) */
  isRapidCycling: boolean;
  /** Average cycle length in days (peak-to-peak or trough-to-trough) */
  avgCycleLength: number | null;
  /** Detected episodes: simplified mood phases */
  episodes: { startDate: string; endDate: string; type: "mania" | "depression" | "mixed" }[];
}

// ── P2: Seasonality analysis ──────────────────────────────────

export interface SeasonalityAnalysis {
  /** Monthly average mood (1-5) for months with data */
  monthlyMood: { month: number; avgMood: number; count: number }[];
  /** Whether a seasonal pattern is detected */
  hasSeasonalPattern: boolean;
  /** Peak months (highest mood) and trough months (lowest mood) */
  peakMonths: number[];
  troughMonths: number[];
  /** Description for the user */
  description: string | null;
}

// ── P2: Calendar heatmap data ──────────────────────────────────

export interface HeatmapDay {
  date: string;
  mood: number | null;
  sleepHours: number | null;
  energy: number | null;
  hasEntry: boolean;
}

export interface InsightsResult {
  sleep: SleepInsights;
  mood: MoodInsights;
  rhythm: RhythmInsights;
  chart: ChartInsights;
  combinedPatterns: CombinedPattern[];
  risk: RiskScore | null;
  thermometer: MoodThermometer | null;
  /** P2: Episode prediction based on multi-signal scoring */
  prediction: EpisodePrediction | null;
  /** P2: Rapid cycling detection */
  cycling: CyclingAnalysis | null;
  /** P2: Seasonality analysis */
  seasonality: SeasonalityAnalysis | null;
  /** P2: Calendar heatmap data (last 90 days) */
  heatmap: HeatmapDay[];
  /** Personal stability score (0-100) — composite of sleep, mood, medication */
  stability: StabilityScore | null;
  /** Spending × Mood clinical insight card */
  spendingMood: SpendingMoodInsight;
}

export interface StabilityScore {
  /** Composite score 0-100 (higher = more stable) */
  score: number;
  /** Qualitative level */
  level: "instavel" | "variavel" | "moderado" | "estavel" | "muito_estavel";
  /** Human-readable label */
  label: string;
  /** Component scores for breakdown display */
  components: {
    sleepRegularity: number | null;    // 0-100 (weight: 35%)
    medicationAdherence: number | null; // 0-100 (weight: 30%)
    moodStability: number | null;      // 0-100 (weight: 20%)
    instability: number | null;        // 0-100 (weight: 15%, inverse of mood amplitude)
  };
  /** true when dataAvailable < 10 (score may shift with more data) */
  provisional: boolean;
  /** Confidence based on data density */
  confidence: "low" | "medium" | "high";
  /** Delta vs 90-day baseline (positive = improving) */
  deltaVsBaseline: number | null;
  /** Risk guardrail applied — score capped at 40 */
  riskCapped: boolean;
  /** Minimum days of data needed vs available */
  dataAvailable: number;
  dataMinimum: number;
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

/**
 * Identify "main sleep" vs afternoon nap for risk scoring.
 * Afternoon/evening naps (< 4h, bedtime 12:00–19:59) are excluded because
 * wearables record them as sleep sessions that skew risk calculations.
 */
function isMainSleep(log: SleepLogInput): boolean {
  if (log.totalHours >= 4) return true;
  const btMin = timeToMinutes(log.bedtime);
  if (btMin === null) return true; // Can't determine, assume main sleep
  // Bedtime between 12:00 (720) and 19:59 (1199) = likely afternoon nap
  if (btMin >= 720 && btMin < 1200) return false;
  return true;
}

/** Check if two YYYY-MM-DD dates are exactly 1 day apart. */
function isNextDay(dateA: string, dateB: string): boolean {
  const a = new Date(dateA + "T12:00:00Z");
  const b = new Date(dateB + "T12:00:00Z");
  const diffMs = b.getTime() - a.getTime();
  return diffMs >= 23 * 3600000 && diffMs <= 25 * 3600000;
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

/** Safely parse a JSON string that should be string[]. Returns [] on any error. */
function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

// ── Sleep Insights ──────────────────────────────────────────

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

  if (last7.length >= 2 && prev7.length >= 2) {
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

  // Use currentStreak (active state) for alerts
  // Filter out records < 2h (likely wearable data issues — forgot watch, partial recording)
  const reliableSorted = sorted.filter((log) => log.totalHours >= 2);
  const consecutiveShortNow = currentStreak(reliableSorted, (log) => log.totalHours < 6);
  if (consecutiveShortNow >= 3) {
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
        message: `Sua média dos últimos 7 dias está ${Math.abs(deviationMin)} minutos abaixo da sua mediana dos registros recentes. `
          + `Mudanças significativas no sono merecem atenção, especialmente se combinadas com outros sinais.`,
      });
    }
    if (deviationMin >= 60) {
      alerts.push({
        variant: "info",
        title: "Sono acima do seu padrão",
        message: `Sua média dos últimos 7 dias está ${deviationMin} minutos acima da sua mediana dos registros recentes. `
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

  // 9. Social Jet Lag (weekday vs weekend midpoint difference)
  let socialJetLag: number | null = null;
  let socialJetLagLabel: string | null = null;
  if (recordCount >= 7) {
    const weekdayMids: number[] = [];
    const weekendMids: number[] = [];
    for (const s of sorted) {
      const btMin = timeToMinutes(s.bedtime);
      if (btMin === null) continue;
      const mid = normalizeBedtime(btMin) + (s.totalHours * 60) / 2;
      const dayOfWeek = new Date(s.date + "T12:00:00").getDay(); // 0=Sun, 6=Sat
      if (dayOfWeek === 0 || dayOfWeek === 6) weekendMids.push(mid);
      else weekdayMids.push(mid);
    }
    if (weekdayMids.length >= 3 && weekendMids.length >= 2) {
      const avgWeekday = weekdayMids.reduce((a, b) => a + b, 0) / weekdayMids.length;
      const avgWeekend = weekendMids.reduce((a, b) => a + b, 0) / weekendMids.length;
      socialJetLag = Math.round(Math.abs(avgWeekend - avgWeekday));
      socialJetLagLabel = socialJetLag <= 30 ? "Baixo"
        : socialJetLag <= 60 ? "Moderado"
        : "Alto";
      if (socialJetLag > 60) {
        alerts.push({
          variant: "info",
          title: "Jet lag social detectado",
          message: `Seu ponto médio de sono muda ${socialJetLag} minutos entre dias úteis e fins de semana. `
            + `Essa diferença desregula o ritmo circadiano. Tente manter horários semelhantes todos os dias.`,
        });
      }
    }
  }

  // 10. Data confidence
  const dataConfidence: DataConfidence = recordCount >= 14 ? "alta"
    : recordCount >= 7 ? "media"
    : "baixa";

  return {
    avgDuration, avgDurationColor, bedtimeVariance, bedtimeVarianceColor,
    sleepTrend, sleepTrendDelta, avgQuality,
    midpoint, midpointTrend, midpointDelta,
    durationVariability, durationVariabilityColor,
    recordCount, sleepHeadline, alerts,
    socialJetLag, socialJetLagLabel, dataConfidence,
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

  // 4. Top warning signs (last 7 days only — matches UI label)
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

/** Convert variance to regularity score 10-100.
 *  ≤30min = 100 (very regular), ≥240min = 10 (very irregular).
 *  Floor of 10 ensures users who sleep regularly get credit even with high variance. */
export function regularityScoreFromVariance(v: number): number {
  if (v <= 30) return 100;
  if (v >= 240) return 10;
  return Math.round(10 + 90 * (1 - (v - 30) / 210));
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

    // SRM-like window score: % of days within ±45min of personal median
    let windowScore: number | null = null;
    if (values.length >= 3) {
      const med = median(values);
      if (med !== null) {
        const withinWindow = values.filter((v) => Math.abs(v - med) <= 45).length;
        windowScore = Math.round((withinWindow / values.length) * 100);
      }
    }

    anchors[field] = { variance, regularityScore, windowScore, color, label: ANCHOR_LABELS[field], source, daysCount };
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

function buildCorrelationResult(rho: number, n: number): CorrelationResult {
  const absRho = Math.abs(rho);
  const strength = absRho < 0.2 ? "muito_fraca" as const
    : absRho < 0.4 ? "fraca" as const
    : absRho < 0.6 ? "moderada" as const
    : "forte" as const;
  const direction = rho >= 0 ? "positiva" as const : "negativa" as const;
  const confidence: DataConfidence = n >= 21 ? "alta" : n >= 14 ? "media" : "baixa";
  return { rho: Math.round(rho * 100) / 100, strength, direction, n, confidence };
}

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
  let corrResult: CorrelationResult | null = null;
  if (validPairs.length >= 14) {
    const r = spearmanCorrelation(validPairs.map((d) => d.sleepHours), validPairs.map((d) => d.mood));
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

  // Lag-1 correlation: sleep(day N) → mood(day N+1) — sanitized
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
      const rLag = spearmanCorrelation(lagSleep, lagMood);
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

// ── Risk Heuristic Score ────────────────────────────────────

function computeRiskScore(
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
  // Wearables record afternoon naps as sleep sessions that skew risk calculations
  const sortedSleep = [...sleepLogs].sort((a, b) => a.date.localeCompare(b.date));
  const mainSleep = sortedSleep.filter((s) => isMainSleep(s) && s.totalHours >= 2);

  // Require minimum data density: if < 4 of last 7 days have main sleep data,
  // the data is too sparse to reliably detect sleep-based risk patterns
  const sevenAgoDt = new Date(today); sevenAgoDt.setDate(sevenAgoDt.getDate() - 6);
  const str7Sleep = dateStr(sevenAgoDt, tz);
  const recentMain = mainSleep.filter((s) => s.date >= str7Sleep);
  const hasSufficientSleepData = recentMain.length >= 4;

  if (hasSufficientSleepData) {
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
    const shortNow = currentStreak(mainSleep, (s) => s.totalHours < 6);
    if (shortNow >= 4) {
      score += 2;
      factors.push(`${shortNow} noites curtas seguidas`);
    }
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
      const sorted = [...expValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const devs = expValues.map((x) => Math.abs(x - med));
      const devsSorted = [...devs].sort((a, b) => a - b);
      const madMid = Math.floor(devsSorted.length / 2);
      const madVal = devsSorted.length % 2 !== 0 ? devsSorted[madMid] : (devsSorted[madMid - 1] + devsSorted[madMid]) / 2;
      const sigma = madVal * 1.4826;

      // Check last 7 days for spending spikes
      const str7 = dateStr(sevenAgo, tz);
      const recentSpikes = Object.entries(dailyExp)
        .filter(([date, val]) => date >= str7 && sigma > 0 && (val - med) / sigma >= 2 && (val - med) >= 50);

      if (recentSpikes.length > 0) {
        score += 2;
        factors.push(`Gasto atípico em ${recentSpikes.length} dia(s) recente(s)`);

        // Extra risk if combined with short sleep or high energy
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

// ── Mood Thermometer (Bipolar Spectrum) ─────────────────────

const MANIA_SIGNS = new Set([
  "pensamentos_acelerados",
  "gastos_impulsivos",
  "energia_excessiva",
  "planos_grandiosos",
  "fala_rapida",
  "sono_reduzido",
  "aumento_atividade",   // ISBD/STEP-BD prodrome
  "agitacao",            // ISBD/STEP-BD prodrome
]);

const DEPRESSION_SIGNS = new Set([
  "isolamento",
  "desinteresse",
  "desesperanca",
  "apetite_alterado",
  "dificuldade_concentracao",
]);

// Signs that indicate distress (anxiety-related) — used for mixed features detection
const DISTRESS_SIGNS = new Set([
  "agitacao",
  "uso_alcool",
  "conflitos",
]);

function getZoneLabel(zone: string, position: number): string {
  switch (zone) {
    case "depressao":
      return "Tendência forte de rebaixamento";
    case "depressao_leve":
      return "Tendência de rebaixamento";
    case "eutimia":
      if (position >= 56) return "Mais próximo do seu padrão (leve tendência de ativação)";
      if (position <= 44) return "Mais próximo do seu padrão (leve tendência de rebaixamento)";
      return "Mais próximo do seu padrão";
    case "hipomania":
      return "Tendência de ativação";
    case "mania":
      return "Ativação intensa";
    default:
      return "Mais próximo do seu padrão";
  }
}

function computeDayScores(
  entry: DiaryEntryInput,
  sleepHours: number | null,
  baselineSleep: number | null,
  hasSleepLog: boolean,
) {
  let M = 0;
  let D = 0;
  const factors: string[] = [];
  // hasSleepLog (param) = true only when objective SleepLog exists for this date

  // Mood contribution
  if (entry.mood >= 4) {
    M += entry.mood === 5 ? 25 : 15;
    factors.push(entry.mood === 5 ? "humor muito elevado" : "humor elevado");
  } else if (entry.mood <= 2) {
    D += entry.mood === 1 ? 25 : 15;
    factors.push(entry.mood === 1 ? "humor muito baixo" : "humor baixo");
  }

  // Energy contribution
  if (entry.energyLevel !== null) {
    if (entry.energyLevel >= 4) {
      M += entry.energyLevel === 5 ? 20 : 12;
      factors.push("energia elevada");
    } else if (entry.energyLevel <= 2) {
      D += entry.energyLevel === 1 ? 20 : 12;
      factors.push("energia baixa");
    }
  }

  // Sleep contribution — relative to baseline when available, with absolute guardrails
  if (sleepHours !== null) {
    // Absolute guardrails always apply (inclusive thresholds)
    if (sleepHours <= 4) {
      M += 15;
      factors.push("sono muito curto");
    } else if (sleepHours > 11) {
      D += 12;
      factors.push("sono muito longo");
    } else if (baselineSleep !== null) {
      // Relative to personal baseline (median of last 21-30 days)
      const delta = sleepHours - baselineSleep;
      if (delta <= -2) {
        M += 15;
        factors.push("sono bem abaixo do seu padrão");
      } else if (delta <= -1) {
        M += 8;
        factors.push("sono abaixo do seu padrão");
      } else if (delta >= 2) {
        D += 12;
        factors.push("sono bem acima do seu padrão");
      } else if (delta >= 1) {
        D += 6;
        factors.push("sono acima do seu padrão");
      }
    } else {
      // Fallback to absolute thresholds when no baseline available
      if (sleepHours < 5) {
        M += 15;
        factors.push("sono muito curto");
      } else if (sleepHours < 6) {
        M += 8;
        factors.push("sono curto");
      } else if (sleepHours > 10) {
        D += 12;
        factors.push("sono muito longo");
      } else if (sleepHours > 9) {
        D += 6;
        factors.push("sono longo");
      }
    }
  }

  // Irritability — contributes to M (activation), also a mixed signal
  if (entry.irritability !== null && entry.irritability >= 4) {
    M += 8;
    factors.push("irritabilidade alta");
  }

  // Anxiety — treated as distress score: small D contribution + mixed signal flag
  // Per DSM-5 mixed features specifier: anxiety is a common co-occurring dimension
  let anxietyDistress = false;
  if (entry.anxietyLevel !== null && entry.anxietyLevel >= 4) {
    D += 5;
    anxietyDistress = true;
    factors.push("ansiedade alta");
  }

  // Warning signs — skip "sono_reduzido" when we have objective sleep data (avoid double counting)
  let distressSignCount = 0;
  {
    const signs = parseStringArray(entry.warningSigns);
    let maniaSigns = 0;
    let depSigns = 0;
    for (const s of signs) {
      if (s === "sono_reduzido" && hasSleepLog) continue;
      if (MANIA_SIGNS.has(s)) maniaSigns++;
      if (DEPRESSION_SIGNS.has(s)) depSigns++;
      if (DISTRESS_SIGNS.has(s)) distressSignCount++;
    }
    M += maniaSigns * 5;
    D += depSigns * 5;
    if (maniaSigns > 0) factors.push(`${maniaSigns} sinais de ativação`);
    if (depSigns > 0) factors.push(`${depSigns} sinais de rebaixamento`);
  }

  // Mixed signal boost: anxiety/distress combined with activation indicators
  // increases both M and D slightly to push toward mixed detection
  const hasActivation = (entry.energyLevel !== null && entry.energyLevel >= 4) ||
    (sleepHours !== null && sleepHours < 6);
  if ((anxietyDistress || distressSignCount >= 2) && hasActivation) {
    M += 5;
    D += 5;
  }

  return { M: Math.min(100, M), D: Math.min(100, D), factors };
}

function computeMoodThermometer(
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): MoodThermometer | null {
  // Need at least 3 days of data
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 3) return null;

  // Use last 7 calendar days with EWMA (alpha=0.4, recent days weigh more)
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const recent = sorted.filter((e) => e.date >= str7);
  if (recent.length < 2) return null;

  const sleepByDate = new Map(sleepLogs.map((s) => [s.date, s.totalHours]));

  // Compute personal sleep baseline: median of last 30 days (excluding extremes <1h and >14h)
  // Uses objective (wearable) data when available, fills gaps with self-reported sleep
  const baselineCutoff = new Date(today);
  baselineCutoff.setDate(baselineCutoff.getDate() - 30);
  const baselineCutoffStr = dateStr(baselineCutoff, tz);
  const baselineEntries = sorted.filter((e) => e.date >= baselineCutoffStr);
  const baselineSleepValues = baselineEntries
    .map((e) => sleepByDate.get(e.date) ?? (e.sleepHours > 0 ? e.sleepHours : null))
    .filter((h): h is number => h !== null && h >= 1 && h <= 14);
  const baselineSleep = baselineSleepValues.length >= 7 ? median(baselineSleepValues) : null;

  // Compute per-day M/D scores
  const dayScores = recent.map((e) => {
    const hasSleepLog = sleepByDate.has(e.date);
    const sleep = sleepByDate.get(e.date) ?? (e.sleepHours > 0 ? e.sleepHours : null);
    return computeDayScores(e, sleep, baselineSleep, hasSleepLog);
  });

  // EWMA smoothing (alpha=0.4 — recent days have higher weight)
  const alpha = 0.4;
  let ewmaM = dayScores[0].M;
  let ewmaD = dayScores[0].D;
  for (let i = 1; i < dayScores.length; i++) {
    ewmaM = alpha * dayScores[i].M + (1 - alpha) * ewmaM;
    ewmaD = alpha * dayScores[i].D + (1 - alpha) * ewmaD;
  }

  const maniaScore = Math.round(ewmaM);
  const depressionScore = Math.round(ewmaD);

  // Map to 0-100 position using M-D difference
  const position = Math.round(
    Math.max(0, Math.min(100, 50 + 0.5 * (maniaScore - depressionScore))),
  );

  // Zone classification
  let zone: MoodThermometer["zone"];
  if (position <= 20) zone = "depressao";
  else if (position <= 38) zone = "depressao_leve";
  else if (position <= 62) zone = "eutimia";
  else if (position <= 80) zone = "hipomania";
  else zone = "mania";

  // Mixed features detection
  // Strong mixed: both scores high and close
  const strongMixed =
    maniaScore >= 30 && depressionScore >= 30 && Math.abs(maniaScore - depressionScore) <= 20;

  // Probable mixed: cross-pattern detection over last 3 days (not just last day)
  // Requires 2+ days with mixed pattern to reduce false positives
  const last3 = recent.slice(-3);
  function dayLooksMixed(e: DiaryEntryInput): boolean {
    const sleep = sleepByDate.get(e.date) ?? (e.sleepHours > 0 ? e.sleepHours : null);
    const shortSleep = sleep !== null && sleep < 6;
    return (
      (e.mood <= 2 && e.energyLevel !== null && e.energyLevel >= 4) ||
      (e.mood <= 2 && e.irritability !== null && e.irritability >= 4 && shortSleep) ||
      (e.anxietyLevel !== null && e.anxietyLevel >= 4 &&
        e.energyLevel !== null && e.energyLevel >= 4 && shortSleep)
    );
  }
  const mixedDayCount = last3.filter(dayLooksMixed).length;
  const probableMixed = !strongMixed && mixedDayCount >= 2;

  const mixedFeatures = strongMixed || probableMixed;
  const mixedStrength: MoodThermometer["mixedStrength"] =
    strongMixed ? "forte" : probableMixed ? "provavel" : null;

  // Instability: combines mood amplitude + position amplitude for fuller picture
  const moods = recent.map((e) => e.mood);
  const moodAmplitude = Math.max(...moods) - Math.min(...moods);
  const positions = dayScores.map((d) => {
    const p = 50 + 0.5 * (d.M - d.D);
    return Math.max(0, Math.min(100, p));
  });
  const posAmplitude = Math.max(...positions) - Math.min(...positions);
  // Normalize position amplitude (0-100) to same 0-4 scale as mood amplitude
  const normalizedPosAmp = posAmplitude / 25;
  const combinedAmplitude = Math.max(moodAmplitude, normalizedPosAmp);
  const instability: MoodThermometer["instability"] =
    combinedAmplitude <= 1 ? "baixa" : combinedAmplitude <= 2 ? "moderada" : "alta";

  // Collect unique factors from the most recent 3 days
  const recentFactors = new Set<string>();
  for (let i = Math.max(0, dayScores.length - 3); i < dayScores.length; i++) {
    for (const f of dayScores[i].factors) recentFactors.add(f);
  }

  return {
    position,
    maniaScore,
    depressionScore,
    zone,
    zoneLabel: getZoneLabel(zone, position),
    mixedFeatures,
    mixedStrength,
    instability,
    factors: Array.from(recentFactors),
    daysUsed: recent.length,
    baselineAvailable: baselineSleep !== null,
  };
}

// ── P2: Episode Prediction (multi-signal early warning) ──────

function computeEpisodePrediction(
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  sleep: SleepInsights,
  thermometer: MoodThermometer | null,
  today: Date,
  tz: string,
): EpisodePrediction | null {
  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const recentEntries = [...entries]
    .filter((e) => e.date >= str7)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recentSleep = [...sleepLogs]
    .filter((s) => s.date >= str7)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (recentEntries.length < 3 && recentSleep.length < 3) return null;

  let maniaRisk = 0;
  let depressionRisk = 0;
  const maniaSignals: string[] = [];
  const depressionSignals: string[] = [];

  // Track which signal categories fired for interaction bonuses
  let sleepReductionFired = false;
  let moodElevationFired = false;
  let energyElevationFired = false;
  let maniaProdromesFired = false;
  let reducedNeedForSleepFired = false;
  let irregularityFired = false;

  // ── 1. Sleep duration (strong mania predictor — Harvey, Goodwin) ──
  // Uses personal baseline (30-day avg) when available to avoid false positives
  // for short sleepers. Falls back to absolute thresholds without baseline.
  if (recentSleep.length >= 3) {
    const avgRecent = recentSleep.reduce((s, l) => s + l.totalHours, 0) / recentSleep.length;
    const baseline = sleep.avgDuration; // 30-day personal average (null if <1 record)
    const hasBaseline = baseline !== null && baseline > 0;

    // Relative reduction: recent avg significantly below personal baseline
    const relativeDropH = hasBaseline ? baseline - avgRecent : 0;
    // Absolute check still needed for extreme values (anyone <5h is concerning)
    const absoluteSevere = avgRecent < 5;
    const absoluteModerate = avgRecent < 6;

    if (absoluteSevere || (hasBaseline && relativeDropH >= 2)) {
      // Severe: <5h absolute OR ≥2h below personal baseline
      maniaRisk += 25;
      maniaSignals.push(
        hasBaseline
          ? `Sono muito reduzido (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Sono muito reduzido (<5h média)",
      );
      sleepReductionFired = true;
    } else if (absoluteModerate || (hasBaseline && relativeDropH >= 1)) {
      // Moderate: <6h absolute OR ≥1h below personal baseline
      maniaRisk += 15;
      maniaSignals.push(
        hasBaseline
          ? `Sono reduzido (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Sono reduzido (<6h média)",
      );
      sleepReductionFired = true;
    }

    // Progressive reduction trend (within the 7-day window itself)
    if (recentSleep.length >= 4) {
      const half = Math.floor(recentSleep.length / 2);
      const first = recentSleep.slice(0, half);
      const second = recentSleep.slice(half);
      const avgFirst = first.reduce((s, l) => s + l.totalHours, 0) / first.length;
      const avgSecond = second.reduce((s, l) => s + l.totalHours, 0) / second.length;
      if (avgSecond < avgFirst - 0.5) {
        maniaRisk += 10;
        maniaSignals.push("Sono em queda progressiva");
        sleepReductionFired = true;
      }
    }

    // Hypersomnia (depression predictor) — also baseline-aware
    const relativeGainH = hasBaseline ? avgRecent - baseline : 0;
    if (avgRecent > 10 || (hasBaseline && relativeGainH >= 3)) {
      depressionRisk += 20;
      depressionSignals.push(
        hasBaseline
          ? `Hipersonia (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Hipersonia (>10h média)",
      );
    } else if (avgRecent > 9 || (hasBaseline && relativeGainH >= 2)) {
      depressionRisk += 10;
      depressionSignals.push(
        hasBaseline
          ? `Sono prolongado (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Sono prolongado (>9h média)",
      );
    }
  }

  // ── 2. Warning signs (ISBD prodrome research) — collected early for interaction checks ──
  const allRecentSigns = new Set<string>();
  for (const e of recentEntries) {
    for (const s of parseStringArray(e.warningSigns)) allRecentSigns.add(s);
  }

  // Clinically distinct: "não preciso dormir" is a core DSM/ISBD mania criterion,
  // NOT the same as insomnia or schedule disruption.
  // Gets its own +12% weight below, so excluded from maniaProdromes to avoid double counting.
  if (allRecentSigns.has("nao_precisa_dormir")) {
    reducedNeedForSleepFired = true;
  }

  const maniaProdromes = ["pensamentos_acelerados", "gastos_impulsivos", "energia_excessiva",
    "planos_grandiosos", "fala_rapida", "aumento_atividade", "agitacao",
    "sociabilidade_aumentada", "comportamento_risco"];
  const depProdromes = ["isolamento", "desesperanca", "dificuldade_concentracao",
    "apetite_alterado", "anedonia"];

  const matchedMania = maniaProdromes.filter((s) => allRecentSigns.has(s));
  const matchedDep = depProdromes.filter((s) => allRecentSigns.has(s));

  if (matchedMania.length >= 3) {
    maniaRisk += 15;
    maniaSignals.push(`${matchedMania.length} sinais prodrômicos de mania`);
    maniaProdromesFired = true;
  } else if (matchedMania.length >= 2) {
    maniaRisk += 8;
    maniaSignals.push(`${matchedMania.length} sinais prodrômicos de mania`);
    maniaProdromesFired = true;
  }

  if (matchedDep.length >= 3) {
    depressionRisk += 15;
    depressionSignals.push(`${matchedDep.length} sinais prodrômicos de depressão`);
  } else if (matchedDep.length >= 2) {
    depressionRisk += 8;
    depressionSignals.push(`${matchedDep.length} sinais prodrômicos de depressão`);
  }

  // "Reduced need for sleep" as standalone strong mania signal (+12%)
  // Distinct from sono_reduzido: the person feels they DON'T NEED sleep (not insomnia)
  if (allRecentSigns.has("nao_precisa_dormir")) {
    maniaRisk += 12;
    maniaSignals.push("Sente que não precisa dormir");
  }

  // ── 3. Sleep regularity disruption — vulnerability modifier (Bauer & Whybrow) ──
  // Irregularity alone (normal duration, no other signals) = vulnerability, not proximal risk.
  // Weight scales up when combined with sleep reduction or mania prodromes.
  if (sleep.bedtimeVariance !== null && sleep.bedtimeVariance > 90) {
    irregularityFired = true;
    const baseIrregularity = 5; // vulnerability alone
    const interactionBonus =
      (sleepReductionFired ? 5 : 0) +
      (reducedNeedForSleepFired ? 5 : 0) +
      (maniaProdromesFired ? 3 : 0);
    const irregularityWeight = baseIrregularity + interactionBonus;
    maniaRisk += irregularityWeight;
    maniaSignals.push("Horários de sono irregulares");
  }

  // ── 4. Mood elevation/escalation ──
  if (recentEntries.length >= 3) {
    const moods = recentEntries.map((e) => e.mood);
    const highMoodDays = moods.filter((m) => m >= 4).length;
    const lowMoodDays = moods.filter((m) => m <= 2).length;
    const avgMood = moods.reduce((a, b) => a + b, 0) / moods.length;

    if (highMoodDays >= 3) {
      maniaRisk += 15;
      maniaSignals.push(`Humor elevado ${highMoodDays}/${moods.length} dias`);
      moodElevationFired = true;
    }
    if (lowMoodDays >= 3) {
      depressionRisk += 15;
      depressionSignals.push(`Humor baixo ${lowMoodDays}/${moods.length} dias`);
    }

    // Escalation: mood going up over the period
    if (moods.length >= 4) {
      const half = Math.floor(moods.length / 2);
      const firstAvg = moods.slice(0, half).reduce((a, b) => a + b, 0) / half;
      const secondAvg = moods.slice(half).reduce((a, b) => a + b, 0) / (moods.length - half);
      if (secondAvg > firstAvg + 0.5 && avgMood >= 3.5) {
        maniaRisk += 10;
        maniaSignals.push("Humor em escalada");
        moodElevationFired = true;
      }
      if (secondAvg < firstAvg - 0.5 && avgMood <= 2.5) {
        depressionRisk += 10;
        depressionSignals.push("Humor em queda");
      }
    }
  }

  // ── 5. Energy / irritability / anxiety (Kessing, STEP-BD) ──
  const highEnergy = recentEntries.filter((e) => e.energyLevel !== null && e.energyLevel >= 4).length;
  const lowEnergy = recentEntries.filter((e) => e.energyLevel !== null && e.energyLevel <= 2).length;
  if (highEnergy >= 3) {
    maniaRisk += 10;
    maniaSignals.push("Energia elevada frequente");
    energyElevationFired = true;
  }
  if (lowEnergy >= 3) {
    depressionRisk += 10;
    depressionSignals.push("Energia baixa frequente");
  }

  const highIrritability = recentEntries.filter((e) => e.irritability !== null && e.irritability >= 4).length;
  if (highIrritability >= 2) {
    maniaRisk += 8;
    maniaSignals.push("Irritabilidade alta");
  }

  // Anxiety: high anxiety contributes to depression risk (also common in mixed states)
  const highAnxiety = recentEntries.filter((e) => e.anxietyLevel !== null && e.anxietyLevel >= 4).length;
  if (highAnxiety >= 3) {
    depressionRisk += 8;
    depressionSignals.push("Ansiedade elevada frequente");
  }

  // ── 6. Thermometer corroboration — capped to avoid double counting with mood ──
  // Thermometer EWMA and mood elevation measure overlapping constructs.
  // Apply reduced weight when mood elevation already fired.
  if (thermometer) {
    if (thermometer.maniaScore >= 40) {
      const thermoManiaWeight = moodElevationFired ? 5 : 10;
      maniaRisk += thermoManiaWeight;
    }
    if (thermometer.depressionScore >= 40) {
      depressionRisk += 10;
    }
  }

  // ── 7. Medication non-adherence amplifies risk ──
  const recentMeds = recentEntries.filter((e) => e.tookMedication !== null);
  const noMedDays = recentMeds.filter((e) => e.tookMedication === "nao").length;
  if (recentMeds.length >= 3 && noMedDays / recentMeds.length >= 0.5) {
    maniaRisk += 10;
    depressionRisk += 10;
    maniaSignals.push("Baixa adesão à medicação");
    depressionSignals.push("Baixa adesão à medicação");
  }

  // ── 8. Interaction bonus: mania activation cluster ──
  // When ≥3 independent signal categories fire, the convergence is clinically
  // more significant than the sum — add cluster bonus (ISBD, STEP-BD).
  const maniaCategories = [
    sleepReductionFired || reducedNeedForSleepFired,
    moodElevationFired,
    energyElevationFired,
    maniaProdromesFired,
    irregularityFired,
  ].filter(Boolean).length;
  if (maniaCategories >= 4) {
    maniaRisk += 10;
    maniaSignals.push("Convergência de múltiplos sinais de ativação");
  } else if (maniaCategories >= 3) {
    maniaRisk += 5;
    maniaSignals.push("Convergência de sinais de ativação");
  }

  // ── 9. Mixed state flag ──
  // Both mania and depression signals elevated simultaneously — highest suicide risk (ISBD)
  if (maniaRisk >= 20 && depressionRisk >= 20) {
    const mixedBonus = 8;
    maniaRisk += mixedBonus;
    depressionRisk += mixedBonus;
    maniaSignals.push("Sinais mistos (mania + depressão simultâneos)");
    depressionSignals.push("Sinais mistos (mania + depressão simultâneos)");
  }

  // Cap at 100
  maniaRisk = Math.min(100, maniaRisk);
  depressionRisk = Math.min(100, depressionRisk);

  const maxRisk = Math.max(maniaRisk, depressionRisk);
  const level: EpisodePrediction["level"] =
    maxRisk >= 50 ? "elevado" : maxRisk >= 25 ? "moderado" : "baixo";

  // Generate recommendations
  const recommendations: string[] = [];
  if (level === "elevado") {
    recommendations.push("Considere entrar em contato com seu profissional de saúde");
    if (maniaRisk >= 20 && depressionRisk >= 20) {
      // Mixed state — specific guidance
      recommendations.push("Sinais mistos detectados — priorize contato com profissional");
      recommendations.push("Mantenha rotina estável e evite decisões importantes");
    } else if (maniaRisk > depressionRisk) {
      recommendations.push("Priorize higiene do sono: escureça o quarto, evite telas, mantenha horário fixo");
      recommendations.push("Evite estímulos excessivos e atividades noturnas");
    } else {
      recommendations.push("Mantenha atividades sociais mesmo que não tenha vontade");
      recommendations.push("Tente manter a rotina de exercícios e exposição à luz natural");
    }
  } else if (level === "moderado") {
    recommendations.push("Monitore os sinais nos próximos dias");
    recommendations.push("Mantenha rotina regular de sono e atividades");
  }

  return {
    maniaRisk,
    depressionRisk,
    maniaSignals,
    depressionSignals,
    level,
    recommendations,
    daysUsed: Math.max(recentEntries.length, recentSleep.length),
  };
}

// ── P2: Rapid Cycling Detection ──────────────────────────────

function computeCyclingAnalysis(
  entries: DiaryEntryInput[],
  today: Date,
  tz: string,
): CyclingAnalysis | null {
  // Need at least 30 days of data
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(ninetyAgo.getDate() - 89);
  const str90 = dateStr(ninetyAgo, tz);
  const sorted = [...entries].filter((e) => e.date >= str90).sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 14) return null;

  // Classify each day as mania-like, depression-like, or euthymic
  // Using 3-day smoothing to reduce noise
  type Phase = "mania" | "depression" | "mixed" | "euthymia";
  const phases: { date: string; phase: Phase }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 1), Math.min(sorted.length, i + 2));
    const avgMood = window.reduce((s, e) => s + e.mood, 0) / window.length;
    const energyVals = window.map((e) => e.energyLevel).filter((v): v is number => v !== null);
    const avgEnergy = energyVals.length > 0
      ? energyVals.reduce((s, v) => s + v, 0) / energyVals.length
      : 3; // neutral when no energy data

    let phase: Phase;
    if (avgMood >= 3.8 && avgEnergy >= 3.5) {
      phase = "mania";
    } else if (avgMood <= 2.2) {
      phase = "depression";
    } else if (avgMood <= 2.5 && avgEnergy >= 3.5) {
      phase = "mixed";
    } else {
      phase = "euthymia";
    }
    phases.push({ date: sorted[i].date, phase });
  }

  // Detect episodes: consecutive calendar days in same phase (minimum 2 days)
  const episodes: CyclingAnalysis["episodes"] = [];
  let currentPhase: Phase | null = null;
  let phaseStart = "";
  let phaseLength = 0;
  let prevDate: string | null = null;

  for (let i = 0; i < phases.length; i++) {
    const { date, phase } = phases[i];
    const isConsecutive = prevDate ? isNextDay(prevDate, date) : true;

    if (phase === currentPhase && isConsecutive) {
      phaseLength++;
    } else {
      if (currentPhase && currentPhase !== "euthymia" && phaseLength >= 2) {
        episodes.push({
          startDate: phaseStart,
          endDate: prevDate ?? date,
          type: currentPhase,
        });
      }
      currentPhase = phase;
      phaseStart = date;
      phaseLength = 1;
    }
    prevDate = date;
  }
  // Close final episode
  if (currentPhase && currentPhase !== "euthymia" && phaseLength >= 2) {
    episodes.push({
      startDate: phaseStart,
      endDate: phases[phases.length - 1].date,
      type: currentPhase,
    });
  }

  // Count polarity switches (mania→depression or depression→mania)
  let switches = 0;
  for (let i = 1; i < episodes.length; i++) {
    const prev = episodes[i - 1].type;
    const curr = episodes[i].type;
    if ((prev === "mania" && (curr === "depression" || curr === "mixed")) ||
        (prev === "depression" && (curr === "mania" || curr === "mixed")) ||
        (prev === "mixed" && (curr === "mania" || curr === "depression"))) {
      switches++;
    }
  }

  // Calculate average cycle length
  let avgCycleLength: number | null = null;
  if (episodes.length >= 2) {
    const starts = episodes.map((e) => new Date(e.startDate + "T12:00:00").getTime());
    const gaps: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      gaps.push(Math.round((starts[i] - starts[i - 1]) / (1000 * 60 * 60 * 24)));
    }
    if (gaps.length > 0) {
      avgCycleLength = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
  }

  // Rapid cycling: ≥4 episodes per year — require ≥60 days observed to avoid inflated extrapolation
  const firstTs = new Date(sorted[0].date + "T12:00:00Z").getTime();
  const lastTs = new Date(sorted[sorted.length - 1].date + "T12:00:00Z").getTime();
  const daysObserved = Math.max(1, Math.round((lastTs - firstTs) / (24 * 60 * 60 * 1000)) + 1);
  const hasEnoughWindow = daysObserved >= 60;
  const annualizedEpisodes = (episodes.length / daysObserved) * 365;
  const isRapidCycling = hasEnoughWindow && annualizedEpisodes >= 4 && episodes.length >= 2;

  return {
    polaritySwitches: switches,
    isRapidCycling,
    avgCycleLength,
    episodes,
  };
}

// ── P2: Seasonality Analysis ──────────────────────────────────

function computeSeasonalityAnalysis(
  entries: DiaryEntryInput[],
): SeasonalityAnalysis | null {
  if (entries.length < 30) return null;

  // Group entries by month
  const byMonth = new Map<number, number[]>();
  for (const e of entries) {
    const month = parseInt(e.date.slice(5, 7), 10);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(e.mood);
  }

  const monthlyMood: SeasonalityAnalysis["monthlyMood"] = [];
  for (const [month, moods] of byMonth) {
    if (moods.length >= 3) {
      monthlyMood.push({
        month,
        avgMood: Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 100) / 100,
        count: moods.length,
      });
    }
  }

  if (monthlyMood.length < 3) return null;

  monthlyMood.sort((a, b) => a.month - b.month);

  // Detect peaks and troughs
  const avgAll = monthlyMood.reduce((s, m) => s + m.avgMood, 0) / monthlyMood.length;
  const peakMonths = monthlyMood.filter((m) => m.avgMood > avgAll + 0.5).map((m) => m.month);
  const troughMonths = monthlyMood.filter((m) => m.avgMood < avgAll - 0.5).map((m) => m.month);

  const hasSeasonalPattern = peakMonths.length > 0 && troughMonths.length > 0;

  const monthNames = [
    "", "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];

  let description: string | null = null;
  if (hasSeasonalPattern) {
    const peakStr = peakMonths.map((m) => monthNames[m]).join(", ");
    const troughStr = troughMonths.map((m) => monthNames[m]).join(", ");
    description = `Humor tende a ser mais elevado em ${peakStr} e mais baixo em ${troughStr}. `
      + `Padrões sazonais são comuns no transtorno bipolar (Kessing et al., Copenhagen). `
      + `Converse com seu profissional sobre ajustes preventivos nessas épocas.`;
  }

  return {
    monthlyMood,
    hasSeasonalPattern,
    peakMonths,
    troughMonths,
    description,
  };
}

// ── P2: Calendar Heatmap Data ──────────────────────────────────

function computeHeatmapData(
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): HeatmapDay[] {
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(ninetyAgo.getDate() - 89);

  const entryMap = new Map(entries.map((e) => [e.date, e]));
  // Filter out naps (<1h) to avoid painting noise on the heatmap
  const realSleep = sleepLogs.filter((s) => s.totalHours >= 1);
  const sleepMap = new Map(realSleep.map((s) => [s.date, s]));

  const days: HeatmapDay[] = [];
  const d = new Date(ninetyAgo);
  while (d <= today) {
    const ds = dateStr(d, tz);
    const entry = entryMap.get(ds);
    const sleepLog = sleepMap.get(ds);
    days.push({
      date: ds,
      mood: entry?.mood ?? null,
      sleepHours: sleepLog?.totalHours ?? null,
      energy: entry?.energyLevel ?? null,
      hasEntry: !!entry || !!sleepLog,
    });
    d.setDate(d.getDate() + 1);
  }

  return days;
}

// ── Stability Score ─────────────────────────────────────────

const STABILITY_WEIGHTS = {
  sleepRegularity: 0.35,
  medicationAdherence: 0.30,
  moodStability: 0.20,
  instability: 0.15,
};

const STABILITY_MIN_DAYS = 5;
const STABILITY_PROVISIONAL_THRESHOLD = 10;
const STABILITY_RISK_CAP = 40;

function computeStabilityScore(
  sleep: SleepInsights,
  mood: MoodInsights,
  risk: RiskScore | null,
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  baselineScore?: number | null,
): StabilityScore | null {
  const dataAvailable = Math.max(sleep.recordCount, entries.length);
  if (dataAvailable < STABILITY_MIN_DAYS) return null;

  // 1. Sleep composite (35%): weighted blend of regularity, duration, quality, HRV
  //    Sub-weights: regularity 30%, duration 30%, quality 25%, HRV 15%
  let sleepReg: number | null = null;
  {
    const subScores: { value: number; weight: number }[] = [];

    // 1a. Bedtime regularity (30%)
    if (sleep.bedtimeVariance != null) {
      subScores.push({ value: regularityScoreFromVariance(sleep.bedtimeVariance), weight: 0.30 });
    }

    // 1b. Duration adequacy (30%): 7-9h = 100, proportional down to 0h = 0
    if (sleep.avgDuration != null) {
      let durScore: number;
      if (sleep.avgDuration >= 7 && sleep.avgDuration <= 9) {
        durScore = 100;
      } else if (sleep.avgDuration < 7) {
        durScore = Math.round(100 * sleep.avgDuration / 7); // 0h=0, 3.5h=50, 7h=100
      } else {
        // Over 9h: gentle decrease, 9h=100, 14h=64 (diminishing, not punitive)
        durScore = Math.max(10, Math.round(100 * (1 - (sleep.avgDuration - 9) / 14)));
      }
      subScores.push({ value: durScore, weight: 0.30 });
    }

    // 1c. Sleep quality (25%): already 0-100
    if (sleep.avgQuality != null) {
      subScores.push({ value: sleep.avgQuality, weight: 0.25 });
    }

    // 1d. HRV health (15%): higher is better, 20ms=0, 60ms+=100
    const hrvValues = sleepLogs
      .filter((l) => l.hrv != null && l.hrv > 0)
      .map((l) => l.hrv!);
    if (hrvValues.length >= 3) {
      const avgHrv = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      const hrvScore = Math.max(0, Math.min(100, Math.round((avgHrv - 20) / 40 * 100)));
      subScores.push({ value: hrvScore, weight: 0.15 });
    }

    if (subScores.length > 0) {
      const totalW = subScores.reduce((s, c) => s + c.weight, 0);
      sleepReg = Math.round(subScores.reduce((s, c) => s + c.value * c.weight, 0) / totalW);
    }
  }

  // 2. Medication adherence (30%): already 0-100
  const medAdherence = mood.medicationAdherence;

  // 3. Mood stability (20%): inverse of mood standard deviation (lower variance = more stable)
  let moodStab: number | null = null;
  if (mood.moodAmplitude != null) {
    moodStab = Math.max(0, Math.min(100, (1 - mood.moodAmplitude / 4) * 100));
  }

  // 4. Instability (15%): inverse of mood amplitude oscillations
  // Uses day-over-day mood change magnitude
  let instabilityScore: number | null = null;
  if (entries.length >= 3) {
    const moodValues = entries
      .map((e) => e.mood)
      .filter((m): m is number => m != null);
    if (moodValues.length >= 3) {
      let totalChange = 0;
      for (let i = 1; i < moodValues.length; i++) {
        totalChange += Math.abs(moodValues[i] - moodValues[i - 1]);
      }
      const avgChange = totalChange / (moodValues.length - 1);
      // avgChange 0 = perfectly stable (100), avgChange ≥ 3 = highly unstable (0)
      instabilityScore = Math.max(0, Math.min(100, (1 - avgChange / 3) * 100));
    }
  }

  // Compute weighted average (skip null components, redistribute weights)
  const weightedComponents = [
    { key: "sleepRegularity", value: sleepReg, weight: STABILITY_WEIGHTS.sleepRegularity },
    { key: "medicationAdherence", value: medAdherence, weight: STABILITY_WEIGHTS.medicationAdherence },
    { key: "moodStability", value: moodStab, weight: STABILITY_WEIGHTS.moodStability },
    { key: "instability", value: instabilityScore, weight: STABILITY_WEIGHTS.instability },
  ];

  const available = weightedComponents.filter((c) => c.value != null);
  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let score = Math.round(
    available.reduce((sum, c) => sum + (c.value! * c.weight) / totalWeight, 0),
  );

  // Risk guardrail: cap score at 40 when risk is high
  const riskCapped = risk?.level === "atencao_alta" && score > STABILITY_RISK_CAP;
  if (riskCapped) {
    score = STABILITY_RISK_CAP;
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  // Provisional flag: not enough data for reliable score
  const provisional = dataAvailable < STABILITY_PROVISIONAL_THRESHOLD;

  // Confidence based on data density
  let confidence: StabilityScore["confidence"];
  if (dataAvailable >= 21) confidence = "high";
  else if (dataAvailable >= 10) confidence = "medium";
  else confidence = "low";

  // Delta vs baseline (positive = improving)
  const deltaVsBaseline = baselineScore != null ? clampedScore - baselineScore : null;

  let level: StabilityScore["level"];
  let label: string;
  if (clampedScore >= 85) { level = "muito_estavel"; label = "Muito estável"; }
  else if (clampedScore >= 70) { level = "estavel"; label = "Estável"; }
  else if (clampedScore >= 50) { level = "moderado"; label = "Moderado"; }
  else if (clampedScore >= 30) { level = "variavel"; label = "Variável"; }
  else { level = "instavel"; label = "Instável"; }

  return {
    score: clampedScore,
    level,
    label,
    components: {
      sleepRegularity: sleepReg != null ? Math.round(sleepReg) : null,
      medicationAdherence: medAdherence != null ? Math.round(medAdherence) : null,
      moodStability: moodStab != null ? Math.round(moodStab) : null,
      instability: instabilityScore != null ? Math.round(instabilityScore) : null,
    },
    provisional,
    confidence,
    deltaVsBaseline,
    riskCapped,
    dataAvailable,
    dataMinimum: STABILITY_MIN_DAYS,
  };
}

// ── Spending × Mood Insight ──────────────────────────────────

/** Helper: get date string for day offset from a base date */
function dayOffset(base: Date, offset: number, tz: string): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return dateStr(d, tz);
}

/** Check activation signals in a ±1 day window around a spike date */
function hasActivationWindow(
  spikeDate: string,
  allDates: string[],
  moodByDate: Record<string, number>,
  energyByDate: Record<string, number>,
  sleepByDate: Record<string, number>,
  avgSleep: number,
): { match: boolean; signals: Set<string> } {
  // Build ±1 day window
  const idx = allDates.indexOf(spikeDate);
  const window = [spikeDate];
  if (idx > 0) window.push(allDates[idx - 1]);
  if (idx < allDates.length - 1) window.push(allDates[idx + 1]);
  // Also check adjacent calendar dates not in allDates (mood/sleep may exist on non-expense days)
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

  for (const d of window) {
    if ((moodByDate[d] ?? 0) >= 4) { signals.add("humor"); signalCount++; }
    if ((energyByDate[d] ?? 0) >= 4) { signals.add("energia"); signalCount++; }
    // Sleep: compare to personal average (not absolute 6h) — "less than usual"
    const sleepThreshold = Math.min(avgSleep - 1.5, 6);
    if (d in sleepByDate && sleepByDate[d] < sleepThreshold) { signals.add("sono"); signalCount++; }
  }

  // Require at least 2 signals OR high mood (strongest individual signal for mania)
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

  // Aggregate daily expenses (only negative amounts = expenses)
  const dailyExp: Record<string, number> = {};
  for (const tx of financialTxs) {
    if (tx.amount < 0) {
      dailyExp[tx.date] = (dailyExp[tx.date] ?? 0) + Math.abs(tx.amount);
    }
  }

  const expDates = Object.keys(dailyExp).sort();
  if (expDates.length < 5) return HIDDEN;

  // Build mood/energy/sleep lookups
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

  // Compute average sleep for adaptive threshold (personal baseline)
  const sleepValues = Object.values(sleepByDate);
  const avgSleep = sleepValues.length > 0
    ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
    : 7; // default 7h if no sleep data

  // Count overlap days (expense + mood OR energy — not just mood)
  const overlapDays = expDates.filter((d) =>
    moodByDate[d] != null || energyByDate[d] != null
  );
  if (overlapDays.length < 5) {
    return {
      state: "learning",
      summary: "Ainda estamos aprendendo seu padrão de gastos. Quando houver mais dias registrados, vamos comparar melhor com seu humor.",
      chips: [`${expDates.length} dias com gastos`, `${overlapDays.length} com humor registrado`],
      ctaHref: CTA,
    };
  }

  // MAD z-score for spike detection
  const values = expDates.map((d) => dailyExp[d]);
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

  let sigma: number;
  const devs = values.map((x) => Math.abs(x - median));
  const devsSorted = [...devs].sort((a, b) => a - b);
  const madMid = Math.floor(devsSorted.length / 2);
  const madVal = devsSorted.length % 2 !== 0 ? devsSorted[madMid] : (devsSorted[madMid - 1] + devsSorted[madMid]) / 2;

  if (madVal > 0) {
    sigma = madVal * 1.4826;
  } else {
    // P0 fallback: MAD = 0 (most values are identical).
    // Fall back to mean absolute deviation from median.
    const meanDev = devs.reduce((a, b) => a + b, 0) / devs.length;
    sigma = meanDev > 0 ? meanDev : 0;
  }

  // Adaptive floor: 30% above median (replaces fixed R$50)
  // This scales with the user's spending level
  const adaptiveFloor = Math.max(median * 0.3, 20); // min R$20 to avoid noise on very low spenders

  // Identify spike days (z >= 2 AND above adaptive floor)
  const spikeDays: string[] = [];
  for (const date of expDates) {
    const delta = dailyExp[date] - median;
    if (sigma > 0) {
      if (delta / sigma >= 2 && delta >= adaptiveFloor) {
        spikeDays.push(date);
      }
    } else {
      // sigma = 0: all values are identical. Any value above median is a spike.
      if (delta > 0 && delta >= adaptiveFloor) {
        spikeDays.push(date);
      }
    }
  }

  // Check convergence with ±1 day activation window
  // Strong requires 2+ signals OR high mood; tracks which signals were seen
  const allSignals = new Set<string>();
  const convergentDays = spikeDays.filter((d) => {
    const result = hasActivationWindow(d, expDates, moodByDate, energyByDate, sleepByDate, avgSleep);
    if (result.match) result.signals.forEach((s) => allSignals.add(s));
    return result.match;
  });

  // Determine state — strong requires repetition (2+ convergent days)
  let state: SpendingMoodInsight["state"];
  if (spikeDays.length >= 2 && convergentDays.length >= 2) {
    state = "strong";
  } else if (spikeDays.length >= 1 && convergentDays.length >= 1) {
    state = "watch";
  } else {
    state = "noSignal";
  }

  // Build chart data (last 14 days only for mobile readability)
  // Only for watch/strong states — noSignal doesn't show the chart
  // Chart values are relative to median (e.g., 1.5x) — avoids exposing R$ in clinical context
  let chartData: SpendingMoodChartPoint[] | undefined;
  if (state === "watch" || state === "strong") {
    chartData = [];
    for (let i = 0; i < 14; i++) {
      const d = dayOffset(today, i - 13, tz);
      const parts = d.split("-");
      chartData.push({
        date: `${parts[2]}/${parts[1]}`,
        expense: dailyExp[d] ?? 0,
        mood: moodByDate[d] ?? null,
        spike: spikeDays.includes(d),
      });
    }
  }

  // Build chips — describe what was actually detected, not assumed
  const chips: string[] = [];
  if (spikeDays.length > 0) {
    chips.push(`${spikeDays.length} dia${spikeDays.length > 1 ? "s" : ""} acima do seu padrão`);
  }
  if (convergentDays.length > 0) {
    // Describe actual signals found, not generic "humor mais alto"
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

  // Build signal-accurate summaries (P0: copy must match what logic detected)
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
  /** Optional extended entries (90d) for P2 features (heatmap, cycling, seasonality). Falls back to entries. */
  entries90?: DiaryEntryInput[],
  /** Optional extended sleep logs (90d) for P2 features (heatmap). Falls back to sleepLogs. */
  sleepLogs90?: SleepLogInput[],
  /** Optional financial transactions (30d) for risk score integration. */
  financialTxs?: FinancialTxInput[],
): InsightsResult {
  // Filter out afternoon naps for metrics that need "main sleep" only.
  // Naps (< 4h, bedtime 12:00-19:59) skew averages and risk scoring.
  // They remain in sleepLogs for heatmap, charts, and historical display.
  const mainSleepLogs = sleepLogs.filter((s) => isMainSleep(s));

  const sleep = computeSleepInsights(mainSleepLogs, today, tz);
  const mood = computeMoodInsights(entries, today, tz);
  const rhythm = computeRhythmInsights(rhythms, sleepLogs, plannerBlocks ?? []);
  const chart = computeChartInsights(entries, sleepLogs);
  const combinedPatterns = computeCombinedPatterns(mainSleepLogs, entries);
  const risk = computeRiskScore(sleep, mood, entries, mainSleepLogs, today, tz, financialTxs);
  const thermometer = computeMoodThermometer(entries, mainSleepLogs, today, tz);

  // Mixed state risk boost — per ISBD, mixed states carry the highest suicide
  // risk in bipolar disorder. Apply after thermometer computation.
  if (risk && thermometer?.mixedFeatures) {
    if (thermometer.mixedStrength === "forte") {
      risk.score += 3;
      risk.factors.push("Estado misto forte (risco elevado)");
    } else if (thermometer.mixedStrength === "provavel") {
      risk.score += 2;
      risk.factors.push("Sinais mistos provável");
    }
    // Recalculate level after boost
    risk.level = risk.score <= 1 ? "ok" : risk.score <= 3 ? "atencao" : "atencao_alta";
  }

  // P2 features — use extended data (90d) when available
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
