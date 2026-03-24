import type { DiaryEntryInput, CyclingAnalysis, SeasonalityAnalysis } from "./types";
import { dateStr, isNextDay } from "./stats";

export function computeCyclingAnalysis(
  entries: DiaryEntryInput[],
  today: Date,
  tz: string,
): CyclingAnalysis | null {
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(ninetyAgo.getDate() - 89);
  const str90 = dateStr(ninetyAgo, tz);
  const sorted = [...entries].filter((e) => e.date >= str90).sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 14) return null;

  type Phase = "mania" | "depression" | "mixed" | "euthymia";
  const phases: { date: string; phase: Phase }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 1), Math.min(sorted.length, i + 2));
    const avgMood = window.reduce((s, e) => s + e.mood, 0) / window.length;
    const energyVals = window.map((e) => e.energyLevel).filter((v): v is number => v !== null);
    const avgEnergy = energyVals.length > 0
      ? energyVals.reduce((s, v) => s + v, 0) / energyVals.length
      : 3;

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
  if (currentPhase && currentPhase !== "euthymia" && phaseLength >= 2) {
    episodes.push({
      startDate: phaseStart,
      endDate: phases[phases.length - 1].date,
      type: currentPhase,
    });
  }

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

export function computeSeasonalityAnalysis(
  entries: DiaryEntryInput[],
): SeasonalityAnalysis | null {
  if (entries.length < 30) return null;

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
