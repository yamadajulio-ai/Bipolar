import type {
  SleepInsights, MoodInsights, RiskScore, DiaryEntryInput,
  SleepLogInput, StabilityScore,
} from "./types";
import { regularityScoreFromVariance } from "./stats";

const STABILITY_WEIGHTS = {
  sleepRegularity: 0.35,
  medicationAdherence: 0.30,
  moodStability: 0.20,
  instability: 0.15,
};

const STABILITY_MIN_DAYS = 5;
const STABILITY_PROVISIONAL_THRESHOLD = 10;
const STABILITY_RISK_CAP = 40;

export function computeStabilityScore(
  sleep: SleepInsights,
  mood: MoodInsights,
  risk: RiskScore | null,
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  baselineScore?: number | null,
): StabilityScore | null {
  const dataAvailable = Math.max(sleep.recordCount, entries.length);
  if (dataAvailable < STABILITY_MIN_DAYS) return null;

  // 1. Sleep composite (35%)
  let sleepReg: number | null = null;
  {
    const subScores: { value: number; weight: number }[] = [];

    if (sleep.bedtimeVariance != null) {
      subScores.push({ value: regularityScoreFromVariance(sleep.bedtimeVariance), weight: 0.30 });
    }

    if (sleep.avgDuration != null) {
      let durScore: number;
      if (sleep.avgDuration >= 7 && sleep.avgDuration <= 9) {
        durScore = 100;
      } else if (sleep.avgDuration < 7) {
        durScore = Math.round(100 * sleep.avgDuration / 7);
      } else {
        durScore = Math.max(10, Math.round(100 * (1 - (sleep.avgDuration - 9) / 14)));
      }
      subScores.push({ value: durScore, weight: 0.30 });
    }

    if (sleep.avgQuality != null) {
      subScores.push({ value: sleep.avgQuality, weight: 0.25 });
    }

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

  // 2. Medication adherence (30%)
  const medAdherence = mood.medicationAdherence;

  // 3. Mood stability (20%)
  let moodStab: number | null = null;
  if (mood.moodAmplitude != null) {
    moodStab = Math.max(0, Math.min(100, (1 - mood.moodAmplitude / 4) * 100));
  }

  // 4. Instability (15%)
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
      instabilityScore = Math.max(0, Math.min(100, (1 - avgChange / 3) * 100));
    }
  }

  // Compute weighted average
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

  // Risk guardrail
  const riskCapped = risk?.level === "atencao_alta" && score > STABILITY_RISK_CAP;
  if (riskCapped) {
    score = STABILITY_RISK_CAP;
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  const provisional = dataAvailable < STABILITY_PROVISIONAL_THRESHOLD;

  let confidence: StabilityScore["confidence"];
  if (dataAvailable >= 21) confidence = "high";
  else if (dataAvailable >= 10) confidence = "medium";
  else confidence = "low";

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
