// ── Input types (matching Prisma models) ────────────────────

export interface SleepLogInput {
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  quality: number;
  awakenings: number;
  hrv?: number | null;
  heartRate?: number | null;
}

export interface DiaryEntryInput {
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

export interface DailyRhythmInput {
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

export type StatusColor = "green" | "yellow" | "red";
export type TrendDirection = "up" | "down" | "stable";

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
