import type {
  DiaryEntryInput, SleepLogInput, SleepInsights,
  MoodThermometer, EpisodePrediction,
} from "./types";
import { dateStr, parseStringArray } from "./stats";

export function computeEpisodePrediction(
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

  let sleepReductionFired = false;
  let moodElevationFired = false;
  let energyElevationFired = false;
  let maniaProdromesFired = false;
  let reducedNeedForSleepFired = false;
  let irregularityFired = false;

  // 1. Sleep duration
  if (recentSleep.length >= 3) {
    const avgRecent = recentSleep.reduce((s, l) => s + l.totalHours, 0) / recentSleep.length;
    const baseline = sleep.avgDuration;
    const hasBaseline = baseline !== null && baseline > 0;

    const relativeDropH = hasBaseline ? baseline - avgRecent : 0;
    const absoluteSevere = avgRecent < 5;
    const absoluteModerate = avgRecent < 6;

    if (absoluteSevere || (hasBaseline && relativeDropH >= 2)) {
      maniaRisk += 25;
      maniaSignals.push(
        hasBaseline
          ? `Sono muito reduzido (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Sono muito reduzido (<5h média)",
      );
      sleepReductionFired = true;
    } else if (absoluteModerate || (hasBaseline && relativeDropH >= 1)) {
      maniaRisk += 15;
      maniaSignals.push(
        hasBaseline
          ? `Sono reduzido (${avgRecent.toFixed(1)}h vs ${baseline.toFixed(1)}h habitual)`
          : "Sono reduzido (<6h média)",
      );
      sleepReductionFired = true;
    }

    // Progressive reduction trend
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

    // Hypersomnia
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

  // 2. Warning signs
  const allRecentSigns = new Set<string>();
  for (const e of recentEntries) {
    for (const s of parseStringArray(e.warningSigns)) allRecentSigns.add(s);
  }

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

  if (allRecentSigns.has("nao_precisa_dormir")) {
    maniaRisk += 12;
    maniaSignals.push("Sente que não precisa dormir");
  }

  // 3. Sleep regularity disruption
  if (sleep.bedtimeVariance !== null && sleep.bedtimeVariance > 90) {
    irregularityFired = true;
    const baseIrregularity = 5;
    const interactionBonus =
      (sleepReductionFired ? 5 : 0) +
      (reducedNeedForSleepFired ? 5 : 0) +
      (maniaProdromesFired ? 3 : 0);
    const irregularityWeight = baseIrregularity + interactionBonus;
    maniaRisk += irregularityWeight;
    maniaSignals.push("Horários de sono irregulares");
  }

  // 4. Mood elevation/escalation
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

  // 5. Energy / irritability / anxiety
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

  const highAnxiety = recentEntries.filter((e) => e.anxietyLevel !== null && e.anxietyLevel >= 4).length;
  if (highAnxiety >= 3) {
    depressionRisk += 8;
    depressionSignals.push("Ansiedade elevada frequente");
  }

  // 6. Thermometer corroboration
  if (thermometer) {
    if (thermometer.maniaScore >= 40) {
      const thermoManiaWeight = moodElevationFired ? 5 : 10;
      maniaRisk += thermoManiaWeight;
    }
    if (thermometer.depressionScore >= 40) {
      depressionRisk += 10;
    }
  }

  // 7. Medication non-adherence
  const recentMeds = recentEntries.filter((e) => e.tookMedication !== null);
  const noMedDays = recentMeds.filter((e) => e.tookMedication === "nao").length;
  if (recentMeds.length >= 3 && noMedDays / recentMeds.length >= 0.5) {
    maniaRisk += 10;
    depressionRisk += 10;
    maniaSignals.push("Baixa adesão à medicação");
    depressionSignals.push("Baixa adesão à medicação");
  }

  // 8. Interaction bonus: mania activation cluster
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

  // 9. Mixed state flag
  if (maniaRisk >= 20 && depressionRisk >= 20) {
    const mixedBonus = 8;
    maniaRisk += mixedBonus;
    depressionRisk += mixedBonus;
    maniaSignals.push("Sinais mistos (mania + depressão simultâneos)");
    depressionSignals.push("Sinais mistos (mania + depressão simultâneos)");
  }

  maniaRisk = Math.min(100, maniaRisk);
  depressionRisk = Math.min(100, depressionRisk);

  const maxRisk = Math.max(maniaRisk, depressionRisk);
  const level: EpisodePrediction["level"] =
    maxRisk >= 50 ? "elevado" : maxRisk >= 25 ? "moderado" : "baixo";

  const recommendations: string[] = [];
  if (level === "elevado") {
    recommendations.push("Considere entrar em contato com seu profissional de saúde");
    if (maniaRisk >= 20 && depressionRisk >= 20) {
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
