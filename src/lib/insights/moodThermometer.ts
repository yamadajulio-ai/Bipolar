import type { DiaryEntryInput, SleepLogInput, MoodThermometer } from "./types";
import { timeToMinutes, normalizeBedtime, median, dateStr, parseStringArray } from "./stats";

// ── Sign sets for mood thermometer ─────────────────────────

const MANIA_SIGNS = new Set([
  "pensamentos_acelerados",
  "gastos_impulsivos",
  "energia_excessiva",
  "planos_grandiosos",
  "fala_rapida",
  "sono_reduzido",
  "aumento_atividade",
  "agitacao",
]);

const DEPRESSION_SIGNS = new Set([
  "isolamento",
  "desinteresse",
  "desesperanca",
  "apetite_alterado",
  "dificuldade_concentracao",
]);

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
    if (sleepHours <= 4) {
      M += 15;
      factors.push("sono muito curto");
    } else if (sleepHours > 11) {
      D += 12;
      factors.push("sono muito longo");
    } else if (baselineSleep !== null) {
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

  // Irritability
  if (entry.irritability !== null && entry.irritability >= 4) {
    M += 8;
    factors.push("irritabilidade alta");
  }

  // Anxiety
  let anxietyDistress = false;
  if (entry.anxietyLevel !== null && entry.anxietyLevel >= 4) {
    D += 5;
    anxietyDistress = true;
    factors.push("ansiedade alta");
  }

  // Warning signs
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

  // Mixed signal boost
  const hasActivation = (entry.energyLevel !== null && entry.energyLevel >= 4) ||
    (sleepHours !== null && sleepHours < 6);
  if ((anxietyDistress || distressSignCount >= 2) && hasActivation) {
    M += 5;
    D += 5;
  }

  return { M: Math.min(100, M), D: Math.min(100, D), factors };
}

export function computeMoodThermometer(
  entries: DiaryEntryInput[],
  sleepLogs: SleepLogInput[],
  today: Date,
  tz: string,
): MoodThermometer | null {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 3) return null;

  const sevenAgo = new Date(today);
  sevenAgo.setDate(sevenAgo.getDate() - 6);
  const str7 = dateStr(sevenAgo, tz);
  const recent = sorted.filter((e) => e.date >= str7);
  if (recent.length < 2) return null;

  const sleepByDate = new Map(sleepLogs.map((s) => [s.date, s.totalHours]));

  // Personal sleep baseline: median of last 30 days
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

  // EWMA smoothing (alpha=0.4)
  const alpha = 0.4;
  let ewmaM = dayScores[0].M;
  let ewmaD = dayScores[0].D;
  for (let i = 1; i < dayScores.length; i++) {
    ewmaM = alpha * dayScores[i].M + (1 - alpha) * ewmaM;
    ewmaD = alpha * dayScores[i].D + (1 - alpha) * ewmaD;
  }

  const maniaScore = Math.round(ewmaM);
  const depressionScore = Math.round(ewmaD);

  const position = Math.round(
    Math.max(0, Math.min(100, 50 + 0.5 * (maniaScore - depressionScore))),
  );

  let zone: MoodThermometer["zone"];
  if (position <= 20) zone = "depressao";
  else if (position <= 38) zone = "depressao_leve";
  else if (position <= 62) zone = "eutimia";
  else if (position <= 80) zone = "hipomania";
  else zone = "mania";

  // Mixed features detection
  const strongMixed =
    maniaScore >= 30 && depressionScore >= 30 && Math.abs(maniaScore - depressionScore) <= 20;

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

  // Instability
  const moods = recent.map((e) => e.mood);
  const moodAmplitude = Math.max(...moods) - Math.min(...moods);
  const positions = dayScores.map((d) => {
    const p = 50 + 0.5 * (d.M - d.D);
    return Math.max(0, Math.min(100, p));
  });
  const posAmplitude = Math.max(...positions) - Math.min(...positions);
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
