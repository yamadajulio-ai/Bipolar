import type {
  SleepLogInput, SleepInsights, StatusColor, TrendDirection,
  ClinicalAlert, DataConfidence,
} from "./types";
import {
  timeToMinutes, normalizeBedtime, computeStdDev, median,
  minutesToTime, dateStr, currentStreak,
} from "./stats";

export function computeSleepInsights(sleepLogs: SleepLogInput[], today: Date, tz: string): SleepInsights {
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
