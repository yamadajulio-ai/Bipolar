import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { computeInsights } from "@/lib/insights/computeInsights";
import type { PlannerBlockInput } from "@/lib/insights/computeInsights";
import { aggregateSleepByDay } from "@/lib/insights/stats";
import { Card } from "@/components/Card";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import { StabilityScoreWidget } from "@/components/dashboard/StabilityScoreWidget";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Link from "next/link";

const TZ = "America/Sao_Paulo";

function formatSleepDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const moodLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito deprimido", color: "text-danger-fg" },
  2: { text: "Deprimido", color: "text-warning-fg" },
  3: { text: "Estável", color: "text-success-fg" },
  4: { text: "Elevado", color: "text-warning-fg" },
  5: { text: "Muito elevado", color: "text-danger-fg" },
};

const energyLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito baixa", color: "text-danger-fg" },
  2: { text: "Baixa", color: "text-warning-fg" },
  3: { text: "Normal", color: "text-success-fg" },
  4: { text: "Alta", color: "text-warning-fg" },
  5: { text: "Muito alta", color: "text-danger-fg" },
};

const ZONE_CONFIG = {
  depressao: {
    bg: "bg-mood-depression-bg-subtle border-mood-depression-border",
    chip: "bg-mood-depression-bg-subtle text-mood-depression-fg border border-mood-depression-border",
    label: "Atenção — sinais de depressão",
  },
  depressao_leve: {
    bg: "bg-mood-depression-light-bg-subtle border-mood-depression-light-border",
    chip: "bg-mood-depression-light-bg-subtle text-mood-depression-light-fg border border-mood-depression-light-border",
    label: "Observe — humor mais baixo",
  },
  eutimia: {
    bg: "bg-mood-euthymia-bg-subtle border-mood-euthymia-border",
    chip: "bg-mood-euthymia-bg-subtle text-mood-euthymia-fg border border-mood-euthymia-border",
    label: "Estável",
  },
  hipomania: {
    bg: "bg-mood-mania-bg-subtle border-mood-mania-border",
    chip: "bg-mood-mania-bg-subtle text-mood-mania-fg border border-mood-mania-border",
    label: "Observe — humor elevado",
  },
  mania: {
    bg: "bg-mood-mania-high-bg-subtle border-mood-mania-high-border",
    chip: "bg-mood-mania-high-bg-subtle text-mood-mania-high-fg border border-mood-mania-high-border",
    label: "Atenção — sinais de mania",
  },
} as const;

const RISK_CONFIG = {
  ok: {
    bg: "bg-mood-euthymia-bg-subtle border-mood-euthymia-border",
    chip: "bg-mood-euthymia-bg-subtle text-mood-euthymia-fg border border-mood-euthymia-border",
    label: "Estável",
  },
  atencao: {
    bg: "bg-mood-mania-bg-subtle border-mood-mania-border",
    chip: "bg-mood-mania-bg-subtle text-mood-mania-fg border border-mood-mania-border",
    label: "Observe",
  },
  atencao_alta: {
    bg: "bg-mood-mania-high-bg-subtle border-mood-mania-high-border",
    chip: "bg-mood-mania-high-bg-subtle text-mood-mania-high-fg border border-mood-mania-high-border",
    label: "Atenção",
  },
} as const;

export default async function ViewerHojePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const userId = session.patientUserId;
  const now = new Date();
  const today = localToday();
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });
  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff7Str = localDateStr(cutoff7);

  const [
    todayEntry,
    todaySleep,
    allEntries30,
    allSleepLogs30,
    rawPlannerBlocks30,
    financialTxs30,
    recentSleepLogs7,
    latestMetrics,
    lastWeeklyAssessment,
    activeMedications,
  ] = await Promise.all([
    prisma.diaryEntry.findFirst({
      where: { userId, date: today },
      select: { mood: true, sleepHours: true, energyLevel: true, tookMedication: true, warningSigns: true, snapshotCount: true, moodRange: true, lastSnapshotAt: true },
    }),
    prisma.sleepLog.findFirst({
      where: { userId, date: { in: [today, localDateStr(new Date(now.getTime() - 86400000))] } },
      select: { totalHours: true, quality: true, date: true },
      orderBy: { date: "desc" },
    }),
    prisma.diaryEntry.findMany({
      where: { userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
    }),
    prisma.sleepLog.findMany({
      where: { userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
    }),
    prisma.plannerBlock.findMany({
      where: { userId, startAt: { gte: cutoff30 }, category: { in: ["social", "trabalho", "refeicao"] } },
      select: { startAt: true, category: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.financialTransaction.findMany({
      where: { userId, date: { gte: cutoff30Str } },
      select: { date: true, amount: true, category: true, description: true },
    }),
    prisma.sleepLog.findMany({
      where: { userId, date: { gte: cutoff7Str }, totalHours: { gte: 1 } },
      orderBy: { date: "desc" },
      take: 7,
      select: { hrv: true, heartRate: true },
    }),
    prisma.healthMetric.findMany({
      where: { userId, date: { gte: cutoff7Str } },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.weeklyAssessment.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { date: true, asrmTotal: true, phq9Total: true, phq9Item9: true, createdAt: true },
    }),
    prisma.medication.findMany({
      where: { userId, isActive: true, isAsNeeded: false },
      select: {
        schedules: { where: { effectiveTo: null }, select: { id: true } },
        logs: { where: { date: { gte: cutoff7Str } }, select: { status: true, date: true } },
      },
    }),
  ]);

  // Compute insights
  const sleepLogsForInsights = aggregateSleepByDay(
    allSleepLogs30.filter((l) => l.totalHours >= 2 && !l.excluded),
  );
  const entries30 = allEntries30.filter((e) => e.date >= cutoff30Str);
  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks30.map((b) => {
    const d = new Date(b.startAt);
    return {
      date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
      timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
      category: b.category,
    };
  });

  const insights = computeInsights(
    sleepLogsForInsights,
    entries30,
    [],
    plannerBlocks,
    now,
    TZ,
    allEntries30,
    allSleepLogs30.filter((l) => !l.excluded),
    financialTxs30,
  );

  const { risk, thermometer, combinedPatterns, sleep: sleepInsights } = insights;

  // Zone + Risk
  const hasEnoughData = risk !== null && thermometer !== null;
  const zone = thermometer?.zone ?? "eutimia";
  const zoneConfig = ZONE_CONFIG[zone];
  const riskLevel = risk?.level ?? "ok";
  const riskConfig = RISK_CONFIG[riskLevel];

  const severityOrder: Record<string, number> = { ok: 0, eutimia: 0, depressao_leve: 1, hipomania: 1, atencao: 1, depressao: 2, mania: 2, atencao_alta: 2 };
  const zoneSeverity = severityOrder[zone] ?? 0;
  const riskSeverity = severityOrder[riskLevel] ?? 0;
  const useZone = zoneSeverity >= riskSeverity;
  const heroBg = useZone ? zoneConfig.bg : riskConfig.bg;
  const heroChip = useZone ? zoneConfig.chip : riskConfig.chip;
  const heroLabel = useZone ? zoneConfig.label : riskConfig.label;

  const drivers: string[] = [];
  if (risk?.factors) {
    for (const f of risk.factors) {
      if (drivers.length >= 3) break;
      drivers.push(f);
    }
  }
  if (thermometer?.factors && drivers.length < 3) {
    for (const f of thermometer.factors) {
      if (drivers.length >= 3) break;
      if (!drivers.some((d) => d.includes(f.slice(0, 15)))) drivers.push(f);
    }
  }

  // Today's medication status
  const todayMedExpected = activeMedications.reduce((sum, med) => sum + med.schedules.length, 0);
  const todayMedLogs = activeMedications.flatMap((med) => med.logs.filter((l) => l.date === today));
  const todayMedTaken = todayMedLogs.filter((l) => l.status === "TAKEN").length;
  const todayMedMissed = todayMedLogs.filter((l) => l.status === "MISSED").length;

  // Health data (7d)
  const avgSteps = (() => {
    const steps = latestMetrics.filter((m) => m.metric === "steps");
    if (steps.length === 0) return null;
    return Math.round(steps.reduce((s, m) => s + m.value, 0) / steps.length);
  })();
  const avgHrv = (() => {
    const hrvLogs = recentSleepLogs7.filter((s) => s.hrv !== null);
    if (hrvLogs.length === 0) return null;
    return Math.round(hrvLogs.reduce((s, l) => s + (l.hrv || 0), 0) / hrvLogs.length);
  })();
  const avgHr = (() => {
    const hrLogs = recentSleepLogs7.filter((s) => s.heartRate !== null);
    if (hrLogs.length === 0) return null;
    return Math.round(hrLogs.reduce((s, l) => s + (l.heartRate || 0), 0) / hrLogs.length);
  })();
  const hasHealthData = avgSteps !== null || avgHrv !== null || avgHr !== null;

  // Chart data (7d)
  const chartEntries = allEntries30.filter((e) => e.date >= cutoff7Str);
  const sleepByDateChart = new Map<string, number>();
  for (const log of allSleepLogs30) {
    if (log.date >= cutoff7Str && log.totalHours >= 1 && !log.excluded) {
      const existing = sleepByDateChart.get(log.date);
      sleepByDateChart.set(log.date, (existing ?? 0) + log.totalHours);
    }
  }
  const chartData = chartEntries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: sleepByDateChart.get(e.date) ?? (e.sleepHours > 0 ? e.sleepHours : null),
  }));

  // Financial signals
  const financialDrivers = risk?.factors.filter((f) =>
    f.toLowerCase().includes("gasto") || f.toLowerCase().includes("financ"),
  ) ?? [];
  const hasFinancialSignal = financialDrivers.length > 0;

  const basePath = `/profissional/${token}`;

  return (
    <div className="space-y-4">
      {/* Patient name hero */}
      <div>
        <h1 className="text-xl font-bold text-foreground">{session.patientName}</h1>
        <p className="text-sm text-muted">
          Dados de hoje — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TZ })}
        </p>
      </div>

      {/* Stability Score */}
      {insights.stability && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Score de Estabilidade</h2>
            <Link href={`${basePath}/insights`} className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">Detalhes</Link>
          </div>
          <ErrorBoundary name="StabilityScoreWidget">
            <StabilityScoreWidget stability={insights.stability} />
          </ErrorBoundary>
          <p className="mt-2 text-[11px] text-muted italic">
            Baseado nos últimos 30 dias · Indicador educacional
          </p>
        </Card>
      )}

      {/* Risk Radar / Hero */}
      {hasEnoughData ? (
        <Card className={`${heroBg} border`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${heroChip}`}>
                {heroLabel}
              </span>
              {thermometer?.mixedFeatures && (
                <span className="ml-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold bg-warning-bg-subtle text-warning-fg border border-warning-border">
                  Humor e energia em direções opostas
                </span>
              )}
            </div>
            <Link href={`${basePath}/insights`} className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">
              Detalhes
            </Link>
          </div>
          {drivers.length > 0 && (
            <ul className="space-y-1.5 mb-3">
              {drivers.map((d, i) => {
                const isProtective = d.toLowerCase().includes("protetor") || d.toLowerCase().includes("boa adesão");
                return (
                  <li key={i} className="text-xs flex items-start gap-1.5 text-foreground/80">
                    <span className="mt-0.5 shrink-0" aria-hidden="true">{isProtective ? "✓" : "•"}</span>
                    {d}
                  </li>
                );
              })}
            </ul>
          )}
          {combinedPatterns.length > 0 && (
            <div className="space-y-1">
              {combinedPatterns.slice(0, 2).map((p, i) => (
                <div key={i} className={`text-xs rounded px-2 py-1 ${p.variant === "danger" ? "bg-danger-bg-subtle text-danger-fg" : p.variant === "warning" ? "bg-warning-bg-subtle text-warning-fg" : "bg-info-bg-subtle text-info-fg"}`}>
                  <span className="font-medium">{p.title}:</span> {p.message}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] text-center text-muted italic">
            Indicador educacional · Não substitui avaliação profissional
          </p>
        </Card>
      ) : (
        <Card className="bg-info-bg-subtle border-info-border">
          <p className="text-sm text-info-fg">
            Dados insuficientes para gerar o radar de risco. O paciente precisa de mais registros.
          </p>
        </Card>
      )}

      {/* Today's state */}
      {todayEntry && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-3">Estado de hoje</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[11px] text-muted uppercase tracking-wide">Humor</p>
              <p className={`text-sm font-semibold mt-0.5 ${moodLabels[todayEntry.mood]?.color || "text-foreground"}`}>
                {moodLabels[todayEntry.mood]?.text || `${todayEntry.mood}/5`}
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[11px] text-muted uppercase tracking-wide">Energia</p>
              <p className={`text-sm font-semibold mt-0.5 ${todayEntry.energyLevel ? (energyLabels[todayEntry.energyLevel]?.color || "text-foreground") : "text-muted"}`}>
                {todayEntry.energyLevel ? energyLabels[todayEntry.energyLevel]?.text || `${todayEntry.energyLevel}/5` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[11px] text-muted uppercase tracking-wide">Sono</p>
              <p className="text-sm font-semibold mt-0.5 text-foreground">
                {todaySleep ? formatSleepDuration(todaySleep.totalHours) : "—"}
              </p>
              {todaySleep && sleepInsights.avgDuration !== null && (
                <p className="text-[11px] text-muted">
                  {todaySleep.totalHours >= sleepInsights.avgDuration
                    ? `+${formatSleepDuration(todaySleep.totalHours - sleepInsights.avgDuration)} vs padrão`
                    : `−${formatSleepDuration(sleepInsights.avgDuration - todaySleep.totalHours)} vs padrão`}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-surface-alt p-3">
              <p className="text-[11px] text-muted uppercase tracking-wide">Medicação</p>
              {todayMedExpected > 0 ? (
                <p className={`text-sm font-semibold mt-0.5 ${
                  todayMedTaken === todayMedExpected ? "text-success-fg" :
                  todayMedTaken > 0 ? "text-warning-fg" :
                  todayMedMissed > 0 ? "text-danger-fg" : "text-muted"
                }`}>
                  {todayMedTaken === todayMedExpected
                    ? "Todas tomadas"
                    : todayMedTaken > 0
                      ? `${todayMedTaken} de ${todayMedExpected}`
                      : todayMedMissed > 0
                        ? "Não tomou"
                        : "Ainda não"}
                </p>
              ) : (
                <p className={`text-sm font-semibold mt-0.5 ${
                  todayEntry.tookMedication === "sim" ? "text-success-fg" :
                  todayEntry.tookMedication === "nao" ? "text-danger-fg" : "text-warning-fg"
                }`}>
                  {todayEntry.tookMedication === "sim" ? "Já tomou" :
                   todayEntry.tookMedication === "nao" ? "Não tomou" : "Ainda não"}
                </p>
              )}
            </div>
          </div>
          {(todayEntry.snapshotCount ?? 0) > 0 && (
            <p className="mt-2 text-[11px] text-muted">
              {(todayEntry.snapshotCount ?? 0) > 1
                ? `${todayEntry.snapshotCount} registros hoje${todayEntry.moodRange ? ` (variação: ${todayEntry.moodRange})` : ""}`
                : "1 registro hoje"}
            </p>
          )}
        </Card>
      )}

      {/* Body metrics (7d) */}
      {hasHealthData && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground mb-2">Corpo (7 dias)</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            {avgSteps !== null && (
              <div className="rounded-lg bg-info-bg-subtle/70 p-2">
                <p className="text-base font-semibold text-info-fg">{avgSteps.toLocaleString("pt-BR")}</p>
                <p className="text-[11px] text-info-fg/80">Passos/dia</p>
              </div>
            )}
            {avgHrv !== null && (
              <div className="rounded-lg bg-primary/10 p-2">
                <p className="text-base font-semibold text-primary">{avgHrv} ms</p>
                <p className="text-[11px] text-primary/80">HRV</p>
              </div>
            )}
            {avgHr !== null && (
              <div className="rounded-lg bg-danger-bg-subtle/70 p-2">
                <p className="text-base font-semibold text-danger-fg">{avgHr} bpm</p>
                <p className="text-[11px] text-danger-fg/80">FC repouso</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 7-day chart */}
      {chartData.length >= 2 && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Últimos 7 dias</h2>
            <Link href={`${basePath}/insights`} className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">Insights</Link>
          </div>
          <ErrorBoundary name="DashboardChartWrapper">
            <DashboardChartWrapper data={chartData} />
          </ErrorBoundary>
        </Card>
      )}

      {/* Financial signals */}
      {hasFinancialSignal && (
        <Card className="border border-warning-border bg-warning-bg-subtle">
          <h2 className="text-sm font-semibold text-foreground mb-2">Sinais de gastos</h2>
          <div className="space-y-1.5">
            {financialDrivers.map((d, i) => (
              <p key={i} className="text-xs text-foreground/80">
                <span className="mr-1" aria-hidden="true">⚠</span>
                {d}
              </p>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-muted italic">
            Sinal complementar · Não é diagnóstico
          </p>
        </Card>
      )}

      {/* Last weekly assessment summary */}
      {lastWeeklyAssessment && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Última avaliação semanal</h2>
            <Link href={`${basePath}/avaliacoes`} className="text-xs text-primary hover:underline inline-flex items-center min-h-[44px]">Histórico</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-alt p-2">
              <p className="text-[11px] text-muted">ASRM</p>
              <p className={`text-base font-semibold ${lastWeeklyAssessment.asrmTotal !== null && lastWeeklyAssessment.asrmTotal >= 6 ? "text-warning-fg" : "text-foreground"}`}>
                {lastWeeklyAssessment.asrmTotal ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt p-2">
              <p className="text-[11px] text-muted">PHQ-9</p>
              <p className={`text-base font-semibold ${
                lastWeeklyAssessment.phq9Total !== null && lastWeeklyAssessment.phq9Total >= 15 ? "text-danger-fg" :
                lastWeeklyAssessment.phq9Total !== null && lastWeeklyAssessment.phq9Total >= 10 ? "text-warning-fg" : "text-foreground"
              }`}>
                {lastWeeklyAssessment.phq9Total ?? "—"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-alt p-2">
              <p className="text-[11px] text-muted">Item 9</p>
              <p className={`text-base font-semibold ${lastWeeklyAssessment.phq9Item9 !== null && lastWeeklyAssessment.phq9Item9 >= 1 ? "font-bold text-danger-fg" : "text-foreground"}`}>
                {lastWeeklyAssessment.phq9Item9 ?? "—"}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Realizada em {new Date(lastWeeklyAssessment.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        </Card>
      )}

      <p className="text-center text-[10px] text-muted py-2">
        Dados gerados automaticamente pelo Suporte Bipolar.
        Indicadores educacionais — uso clínico requer interpretação profissional.
      </p>
    </div>
  );
}
