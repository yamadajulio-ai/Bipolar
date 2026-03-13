import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { InsightsCharts } from "@/components/planner/InsightsCharts";
import { NightHistorySelector } from "@/components/insights/NightHistorySelector";
import { computeInsights, formatSleepDuration } from "@/lib/insights/computeInsights";
import { SleepHistoryCard } from "@/components/insights/SleepHistoryCard";
import { MoodThermometer } from "@/components/insights/MoodThermometer";
import type { ClinicalAlert, PlannerBlockInput, CombinedPattern, RiskScore, DataConfidence, CorrelationResult, EpisodePrediction as EpisodePredictionType, CyclingAnalysis as CyclingAnalysisType, SeasonalityAnalysis as SeasonalityAnalysisType, HeatmapDay } from "@/lib/insights/computeInsights";
import { MetricLabel } from "@/components/insights/MetricLabel";
import { SafetyNudge } from "@/components/insights/SafetyNudge";
import { EpisodePrediction } from "@/components/insights/EpisodePrediction";
import { CyclingAnalysis } from "@/components/insights/CyclingAnalysis";
import { CalendarHeatmap } from "@/components/insights/CalendarHeatmap";
import { Sparkline } from "@/components/insights/Sparkline";
import Link from "next/link";
import { Suspense } from "react";

const TZ = "America/Sao_Paulo";

function colorToBg(color: "green" | "yellow" | "red"): string {
  if (color === "green") return "bg-green-500";
  if (color === "yellow") return "bg-amber-500";
  return "bg-red-500";
}

function colorToText(color: "green" | "yellow" | "red"): string {
  if (color === "green") return "Dentro do ideal";
  if (color === "yellow") return "Moderado";
  return "Atenção recomendada";
}

function colorToCardBorder(color: "green" | "yellow" | "red"): string {
  if (color === "green") return "border-l-green-500";
  if (color === "yellow") return "border-l-amber-500";
  return "border-l-red-500";
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "manual",
  planner: "via planejador",
  sleep: "via sono",
};

function ConfidenceBadge({ confidence }: { confidence: DataConfidence }) {
  const config: Record<DataConfidence, { label: string; color: string }> = {
    baixa: { label: "Poucos dados", color: "bg-red-100 text-red-800 border border-red-200" },
    media: { label: "Dados moderados", color: "bg-amber-100 text-amber-800 border border-amber-200" },
    alta: { label: "Dados suficientes", color: "bg-emerald-100 text-emerald-800 border border-emerald-200" },
  };
  const c = config[confidence];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.color}`}>
      {c.label}
    </span>
  );
}

function CorrelationBadge({ result }: { result: CorrelationResult }) {
  const strengthLabels: Record<string, string> = {
    muito_fraca: "Muito fraca",
    fraca: "Fraca",
    moderada: "Moderada",
    forte: "Forte",
  };
  const strengthColors: Record<string, string> = {
    muito_fraca: "text-muted",
    fraca: "text-blue-600",
    moderada: "text-amber-600",
    forte: "text-red-600",
  };
  return (
    <span className={`text-xs font-medium ${strengthColors[result.strength] || "text-muted"}`}>
      {result.direction === "positiva" ? "+" : "−"}{Math.abs(result.rho).toFixed(2)} ({strengthLabels[result.strength]})
    </span>
  );
}

function AlertList({ alerts }: { alerts: ClinicalAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      {alerts.map((alert, i) => (
        <Alert key={i} variant={alert.variant}>
          <p className="font-medium text-sm">{alert.title}</p>
          <p className="mt-1 text-xs opacity-90">{alert.message}</p>
        </Alert>
      ))}
    </div>
  );
}

function RiskBadge({ risk }: { risk: RiskScore }) {
  const config = {
    ok: { bg: "bg-green-100 border-green-300 text-green-800", label: "Estável" },
    atencao: { bg: "bg-amber-100 border-amber-300 text-amber-800", label: "Atenção" },
    atencao_alta: { bg: "bg-red-100 border-red-300 text-red-800", label: "Atenção alta" },
  };
  const c = config[risk.level];

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Status Geral</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${c.bg}`}>
          {c.label}
        </span>
      </div>
      {risk.factors.length > 0 && (
        <ul className="space-y-1">
          {risk.factors.map((f, i) => {
            const isProtective = f.toLowerCase().includes("protetor") || f.toLowerCase().includes("boa adesão");
            return (
              <li key={i} className={`text-xs flex items-start gap-1.5 ${isProtective ? "text-emerald-700" : "text-foreground/70"}`}>
                <span className="mt-0.5 flex-shrink-0">{isProtective ? "✅" : "⚠️"}</span>
                {f}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted italic">
        Indicador heurístico educacional — não substitui avaliação profissional.
      </p>
    </Card>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ noites?: string }>;
}) {
  const session = await getSession();
  const now = new Date();
  const params = await searchParams;
  const rawNoites = params.noites;
  const noitesStr = Array.isArray(rawNoites) ? rawNoites[0] : rawNoites;
  const nightsToShow = Math.min(90, Math.max(7, Number(noitesStr) || 15));

  // Fetch 90 days of sleep for history, 30 days for insights computation
  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90Str = cutoff90.toLocaleDateString("sv-SE", { timeZone: TZ });

  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

  const [allSleepLogs, allEntries, rhythms, rawPlannerBlocks, financialTxs] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.dailyRhythm.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      orderBy: { date: "asc" },
    }),
    prisma.plannerBlock.findMany({
      where: {
        userId: session.userId,
        startAt: { gte: cutoff30 },
        category: { in: ["social", "trabalho", "refeicao"] },
      },
      select: { startAt: true, category: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.financialTransaction.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
      select: { date: true, amount: true },
    }),
  ]);

  // Entries for core metrics (30d) vs full 90d for heatmap/cycling/seasonality
  const entries = allEntries.filter((e) => e.date >= cutoff30Str);

  // For insights computation: last 30 days, only real sleep (>= 1h), not excluded. Under 1h = nap.
  const sleepLogsForInsights = allSleepLogs.filter(
    (l) => l.date >= cutoff30Str && l.totalHours >= 1 && !l.excluded,
  );

  // Convert PlannerBlock DateTime with correct timezone
  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks.map((b) => {
    const d = new Date(b.startAt);
    return {
      date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
      timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
      category: b.category,
    };
  });

  // For heatmap/cycling: exclude user-excluded records but keep cochilos for display
  const allSleepLogsFiltered = allSleepLogs.filter((l) => !l.excluded);
  const insights = computeInsights(sleepLogsForInsights, entries, rhythms, plannerBlocks, now, TZ, allEntries, allSleepLogsFiltered, financialTxs);

  // Filter anchors that have data for the IPSRT section
  const anchorsWithData = Object.entries(insights.rhythm.anchors)
    .filter(([, anchor]) => anchor.variance !== null);

  // Sleep logs for history — show ALL entries (including short ones) up to selected period
  const lastNights = allSleepLogs.filter((l) => l.totalHours > 0).slice(-nightsToShow).reverse();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="mb-1 text-2xl font-bold">Insights</h1>
      <p className="mb-6 text-xs text-muted">
        Baseado em protocolos IPSRT e pesquisas PROMAN/USP · Não substitui avaliação profissional
      </p>

      {/* ── Termômetro de Humor (Espectro Bipolar) ─────────────── */}
      {insights.thermometer && (() => {
        const { maniaScore: _, depressionScore: __, ...safeThermometer } = insights.thermometer;
        return (
          <div className="mb-6">
            <MoodThermometer data={safeThermometer} />
          </div>
        );
      })()}

      {/* ── Status Geral (Risk Heuristic) ─────────────────────────── */}
      {insights.risk && <RiskBadge risk={insights.risk} />}

      {/* ── Combined Patterns ─────────────────────────────────────── */}
      {insights.combinedPatterns.length > 0 && (
        <div className="mb-6 space-y-2">
          {insights.combinedPatterns.map((p, i) => (
            <Alert key={i} variant={p.variant}>
              <p className="font-medium text-sm">{p.title}</p>
              <p className="mt-1 text-xs opacity-90">{p.message}</p>
            </Alert>
          ))}
        </div>
      )}

      {/* ── Seção 1: Seu Sono ───────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🌙</span>
          <h2 className="text-lg font-semibold">Seu Sono</h2>
        </div>
        {insights.sleep.sleepHeadline && (
          <p className={`mb-2 text-sm font-semibold ${
            insights.sleep.sleepHeadline.startsWith("Atenção")
              ? "text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5"
              : "text-emerald-700"
          }`}>
            {insights.sleep.sleepHeadline}
          </p>
        )}
        <p className="mb-4 text-[11px] text-muted">
          Alterações de sono frequentemente precedem mudanças de humor.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {/* Média de sono */}
          <Card className={`border-l-4 ${
            insights.sleep.avgDurationColor && insights.sleep.recordCount >= 7
              ? colorToCardBorder(insights.sleep.avgDurationColor)
              : "border-l-border"
          }`}>
            <MetricLabel metricKey="avgDuration" className="text-[11px] text-muted leading-tight">Média de sono</MetricLabel>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xl font-bold tabular-nums">
                {insights.sleep.avgDuration !== null
                  ? formatSleepDuration(insights.sleep.avgDuration)
                  : "—"}
              </p>
              {insights.heatmap.length >= 7 && (
                <Sparkline
                  data={insights.heatmap.slice(-14).map((d) => d.sleepHours)}
                  color={insights.sleep.avgDurationColor === "green" ? "#22c55e" : insights.sleep.avgDurationColor === "yellow" ? "#f59e0b" : "#ef4444"}
                  baseline={8}
                  min={4}
                  max={12}
                />
              )}
            </div>
            {insights.sleep.avgDurationColor && insights.sleep.recordCount >= 7 && (
              <p className="mt-1 text-[10px] text-muted">{colorToText(insights.sleep.avgDurationColor)}</p>
            )}
            <p className="mt-0.5 text-[10px] text-muted">
              {insights.sleep.recordCount} noites
              {insights.sleep.recordCount > 0 && insights.sleep.recordCount < 7 && " · mín. 7"}
            </p>
          </Card>

          {/* Regularidade */}
          <Card className={`border-l-4 ${
            insights.sleep.bedtimeVarianceColor && insights.sleep.recordCount >= 7
              ? colorToCardBorder(insights.sleep.bedtimeVarianceColor)
              : "border-l-border"
          }`}>
            <MetricLabel metricKey="regularidade" className="text-[11px] text-muted leading-tight">Regularidade</MetricLabel>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.bedtimeVariance !== null
                ? `±${insights.sleep.bedtimeVariance}min`
                : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted">
              {insights.sleep.bedtimeVariance !== null
                ? insights.sleep.bedtimeVariance <= 30 ? "Excelente"
                  : insights.sleep.bedtimeVariance <= 60 ? "Moderada"
                  : "Irregular · meta: ±30min"
                : "variação do horário"}
            </p>
          </Card>

          {/* Variabilidade da duração */}
          <Card className={`border-l-4 ${
            insights.sleep.durationVariabilityColor && insights.sleep.recordCount >= 7
              ? colorToCardBorder(insights.sleep.durationVariabilityColor)
              : "border-l-border"
          }`}>
            <MetricLabel metricKey="variabilidade" className="text-[11px] text-muted leading-tight">Variabilidade</MetricLabel>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.durationVariability !== null
                ? `±${insights.sleep.durationVariability}min`
                : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted">
              {insights.sleep.durationVariability !== null
                ? insights.sleep.durationVariability <= 30 ? "Consistente"
                  : insights.sleep.durationVariability <= 60 ? "Moderada"
                  : "Alta · meta: ±30min"
                : "duração noite a noite"}
            </p>
          </Card>

          {/* Tendência */}
          <Card className="border-l-4 border-l-border">
            <MetricLabel metricKey="tendencia" className="text-[11px] text-muted leading-tight">Tendência</MetricLabel>
            <div className="flex items-baseline gap-1 mt-0.5">
              <p className="text-xl font-bold">
                {insights.sleep.sleepTrend === "up" ? "↑"
                  : insights.sleep.sleepTrend === "down" ? "↓"
                  : insights.sleep.sleepTrend === "stable" ? "→"
                  : "—"}
              </p>
              {insights.sleep.sleepTrendDelta !== null && (
                <span className="text-xs text-muted tabular-nums">
                  {insights.sleep.sleepTrendDelta > 0 ? "+" : ""}
                  {formatSleepDuration(Math.abs(insights.sleep.sleepTrendDelta))}
                </span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted">7 dias vs anteriores</p>
          </Card>

          {/* Ponto médio do sono */}
          <Card className="border-l-4 border-l-border">
            <MetricLabel metricKey="pontoMedio" className="text-[11px] text-muted leading-tight">Ponto médio</MetricLabel>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.midpoint ?? "—"}
            </p>
            {insights.sleep.midpointTrend && (
              <p className="mt-0.5 text-[10px] text-muted">
                {insights.sleep.midpointTrend === "up" ? "↑ Atrasando"
                  : insights.sleep.midpointTrend === "down" ? "↓ Adiantando"
                  : "→ Estável"}
                {insights.sleep.midpointDelta !== null && Math.abs(insights.sleep.midpointDelta) > 0 && (
                  <> ({insights.sleep.midpointDelta > 0 ? "+" : ""}{insights.sleep.midpointDelta}min)</>
                )}
              </p>
            )}
            <p className="mt-0.5 text-[10px] text-muted">marcador circadiano</p>
          </Card>

          {/* Qualidade */}
          <Card className="border-l-4 border-l-border">
            <MetricLabel metricKey="qualidade" className="text-[11px] text-muted leading-tight">Qualidade</MetricLabel>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.avgQuality !== null ? `${insights.sleep.avgQuality}%` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted">wearable (0-100)</p>
          </Card>

          {/* Social Jet Lag */}
          {insights.sleep.socialJetLag !== null && (
            <Card className={`border-l-4 ${
              insights.sleep.socialJetLag > 60 ? "border-l-red-500"
                : insights.sleep.socialJetLag > 30 ? "border-l-amber-500"
                : "border-l-green-500"
            }`}>
              <MetricLabel metricKey="socialJetLag" className="text-[11px] text-muted leading-tight">Social Jet Lag</MetricLabel>
              <p className="text-xl font-bold mt-0.5 tabular-nums">
                {insights.sleep.socialJetLag}min
              </p>
              <p className="mt-1 text-[10px] text-muted">
                {insights.sleep.socialJetLagLabel} · semana vs fim de semana
              </p>
            </Card>
          )}
        </div>

        {/* Data confidence */}
        <div className="mb-2 flex items-center gap-2">
          <ConfidenceBadge confidence={insights.sleep.dataConfidence} />
          <span className="text-[10px] text-muted">
            {insights.sleep.recordCount} noites registradas
          </span>
        </div>

        <AlertList alerts={insights.sleep.alerts} />

        {/* Histórico de noites */}
        {lastNights.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                Histórico
                <span className="ml-1.5 text-xs font-normal text-muted">
                  ({lastNights.length} {lastNights.length === 1 ? "registro" : "registros"})
                </span>
              </h3>
              <Suspense>
                <NightHistorySelector />
              </Suspense>
            </div>
            <div className="space-y-2">
              {lastNights.map((log) => (
                <SleepHistoryCard key={log.id} log={log} />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Seção 2: Seu Humor ──────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧠</span>
          <h2 className="text-lg font-semibold">Seu Humor</h2>
        </div>
        {insights.mood.moodHeadline && (
          <p className={`mb-2 text-sm font-semibold ${
            insights.mood.moodHeadline.includes("elevado") || insights.mood.moodHeadline.includes("oscilação")
              ? "text-amber-800"
              : insights.mood.moodHeadline.includes("queda")
                ? "text-blue-700"
                : "text-emerald-700"
          }`}>
            {insights.mood.moodHeadline}
          </p>
        )}
        <p className="mb-4 text-[11px] text-muted">
          Acompanhar padrões ajuda a identificar fases antes que se intensifiquem.
        </p>

        {entries.length > 0 ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3">
              {/* Tendência */}
              <Card className="border-l-4 border-l-border">
                <MetricLabel metricKey="moodTrend" className="text-[11px] text-muted leading-tight">Tendência (7 dias)</MetricLabel>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xl font-bold">
                    {insights.mood.moodTrend === "up" ? "↑ Subindo"
                      : insights.mood.moodTrend === "down" ? "↓ Caindo"
                      : insights.mood.moodTrend === "stable" ? "→ Estável"
                      : "—"}
                  </p>
                  {insights.heatmap.length >= 7 && (
                    <Sparkline
                      data={insights.heatmap.slice(-14).map((d) => d.mood)}
                      color="#527a6e"
                      baseline={3}
                      min={1}
                      max={5}
                    />
                  )}
                </div>
              </Card>

              {/* Variabilidade (amplitude) */}
              <Card className={`border-l-4 ${
                insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 3
                  ? "border-l-red-500"
                  : insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 2
                    ? "border-l-amber-500"
                    : "border-l-border"
              }`}>
                <MetricLabel metricKey="oscilacao" className="text-[11px] text-muted leading-tight">Oscilação (7 dias)</MetricLabel>
                <p className="text-xl font-bold mt-0.5">
                  {insights.mood.moodAmplitudeLabel ?? "—"}
                </p>
                {insights.mood.moodAmplitude !== null && (
                  <p className="mt-0.5 text-[10px] text-muted">
                    {insights.mood.moodAmplitude} {insights.mood.moodAmplitude === 1 ? "ponto" : "pontos"}
                  </p>
                )}
              </Card>

              {/* Adesão medicação */}
              <Card className={`border-l-4 ${
                insights.mood.medicationAdherence !== null && insights.mood.medicationAdherence < 80
                  ? "border-l-amber-500"
                  : insights.mood.medicationAdherence !== null && insights.mood.medicationAdherence >= 90
                    ? "border-l-green-500"
                    : "border-l-border"
              }`}>
                <MetricLabel metricKey="medicacao" className="text-[11px] text-muted leading-tight">Medicação</MetricLabel>
                <p className="text-xl font-bold mt-0.5 tabular-nums">
                  {insights.mood.medicationAdherence !== null
                    ? `${insights.mood.medicationAdherence}%`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {insights.mood.medicationResponseRate
                    ? `${insights.mood.medicationResponseRate}`
                    : "últimos 30 dias"}
                </p>
              </Card>

              {/* Sinais de alerta */}
              <Card className={`border-l-4 ${
                insights.mood.topWarningSigns.length > 0
                  ? "border-l-amber-500"
                  : "border-l-border"
              }`}>
                <MetricLabel metricKey="sinaisAlerta" className="text-[11px] text-muted leading-tight">Sinais de alerta</MetricLabel>
                {insights.mood.topWarningSigns.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {insights.mood.topWarningSigns.map((sign) => (
                      <li key={sign.key} className="text-[11px] leading-tight">
                        {sign.label} <span className="text-muted tabular-nums">({sign.count}x)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-bold text-emerald-600">Nenhum</p>
                )}
              </Card>
            </div>

            <AlertList alerts={insights.mood.alerts} />
          </>
        ) : (
          <Card>
            <p className="text-sm text-muted">
              Nenhum registro de humor nos últimos 30 dias.
              Faça check-ins diários para ver tendências e alertas aqui.
            </p>
            <Link
              href="/diario/novo"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Fazer check-in
            </Link>
          </Card>
        )}
      </section>

      {/* ── Seção 3: Seu Ritmo Social (IPSRT) ──────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⏰</span>
          <h2 className="text-lg font-semibold">Seu Ritmo Social</h2>
        </div>
        <p className="mb-4 text-xs text-foreground/60">
          Mede o quão regular é a sua rotina diária. Horários consistentes para dormir, acordar e atividades
          protegem contra episódios. Quanto maior a %, mais regular.
        </p>

        {anchorsWithData.length > 0 ? (
          <Card className="mb-4">
            {/* Regularidade geral */}
            {insights.rhythm.overallRegularity !== null && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <MetricLabel metricKey="regularidadeGeral" className="text-sm font-medium">Regularidade geral</MetricLabel>
                  <span className={`text-sm font-bold ${
                    insights.rhythm.overallRegularity >= 70 ? "text-emerald-600"
                      : insights.rhythm.overallRegularity >= 40 ? "text-amber-600"
                      : "text-red-600"
                  }`}>{insights.rhythm.overallRegularity}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-black/10">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      insights.rhythm.overallRegularity >= 70 ? "bg-emerald-400"
                        : insights.rhythm.overallRegularity >= 40 ? "bg-amber-400"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${Math.max(3, insights.rhythm.overallRegularity)}%` }}
                  />
                </div>
                {insights.rhythm.overallRegularity < 30 && (
                  <p className="mt-1.5 text-[11px] text-foreground/60">
                    Regularidade baixa indica horários muito variáveis. Tente fixar primeiro o horário de acordar — é o que mais impacta o ritmo.
                  </p>
                )}
              </div>
            )}

            {/* Anchors with regularity score bars (bigger = more regular) */}
            <div className="space-y-3">
              {anchorsWithData.map(([key, anchor]) => {
                const score = anchor.regularityScore ?? 0;
                return (
                  <div key={key}>
                    <div className="flex items-center gap-3">
                      <div className="w-40 flex-shrink-0">
                        <span className="text-sm">{anchor.label}</span>
                        {anchor.source && (
                          <span className="ml-1 text-[10px] text-muted">
                            ({SOURCE_LABELS[anchor.source]})
                          </span>
                        )}
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-black/10">
                        <div
                          className={`h-2 rounded-full ${colorToBg(anchor.color!)}`}
                          style={{ width: `${Math.max(5, score)}%` }}
                        />
                      </div>
                      <div className="w-20 text-right flex-shrink-0">
                        <span className="text-xs font-medium">{score}%</span>
                        <span className="text-[10px] text-muted ml-1">±{anchor.variance}min</span>
                      </div>
                    </div>
                    {anchor.windowScore !== null && (
                      <div className="ml-40 pl-3 mt-0.5 text-[10px] text-muted">
                        Janela SRM: {anchor.windowScore}% dos dias dentro de ±45min
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Days count and data source note */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {anchorsWithData.map(([key, anchor]) => (
                <span key={key} className="text-[10px] text-muted">
                  {anchor.label}: {anchor.daysCount} dias
                </span>
              ))}
            </div>

            {(insights.rhythm.usedSleepFallback || insights.rhythm.usedPlannerFallback) && (
              <p className="mt-2 text-xs text-muted italic">
                {insights.rhythm.usedSleepFallback && insights.rhythm.usedPlannerFallback
                  ? "* Dados complementados com registros de sono e eventos do planejador."
                  : insights.rhythm.usedSleepFallback
                    ? "* Dados de \"Acordar\" e \"Dormir\" complementados com registros de sono."
                    : "* Dados de contato social, atividade e jantar inferidos do planejador."}
              </p>
            )}
          </Card>
        ) : (
          <Card className="mb-4">
            <h3 className="mb-2 text-sm font-semibold">O que é o Ritmo Social?</h3>
            <p className="mb-3 text-sm text-muted">
              A Terapia Interpessoal de Ritmos Sociais (IPSRT) é uma abordagem desenvolvida
              especificamente para o transtorno bipolar. Ela monitora 5 atividades-âncora do dia:
              horário de acordar, primeiro contato social, início da atividade principal, jantar
              e horário de dormir. Quanto mais regulares essas âncoras, maior a estabilidade do humor.
            </p>
            <p className="mb-3 text-sm text-muted">
              Registre blocos no planejador (categorias social, trabalho e refeição) ou preencha
              o formulário de ritmo diário para ativar esta seção automaticamente.
            </p>
            <Link
              href="/rotina/novo"
              className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Registrar meu ritmo de hoje
            </Link>
          </Card>
        )}

        <AlertList alerts={insights.rhythm.alerts} />
      </section>

      {/* ── Seção 4: Humor e Sono (gráfico) ─────────────────────── */}
      {insights.chart.chartData.length >= 3 && (
        <section className="mb-8">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Humor e Sono</h2>
            <InsightsCharts data={insights.chart.chartData} />

            {/* Correlation results */}
            {(insights.chart.correlation || insights.chart.lagCorrelation) && (
              <div className="mt-3 space-y-1.5 rounded-lg bg-surface-alt p-3">
                {insights.chart.correlation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Correlação sono→humor</span>
                    <CorrelationBadge result={insights.chart.correlation} />
                  </div>
                )}
                {insights.chart.lagCorrelation && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Sono ontem→humor hoje</span>
                    <CorrelationBadge result={insights.chart.lagCorrelation} />
                  </div>
                )}
                <p className="text-[10px] text-muted italic">
                  Correlação não prova causa. n={insights.chart.correlation?.n ?? insights.chart.lagCorrelation?.n ?? 0} dias.
                </p>
              </div>
            )}

          </Card>
        </section>
      )}

      {/* ── P2: Episode Prediction ──────────────────────────────── */}
      {insights.prediction && (insights.prediction.maniaRisk > 0 || insights.prediction.depressionRisk > 0) && (
        <section className="mb-8">
          <EpisodePrediction data={insights.prediction} />
        </section>
      )}

      {/* ── P2: Cycling Analysis ──────────────────────────────── */}
      {insights.cycling && insights.cycling.episodes.length > 0 && (
        <section className="mb-8">
          <CyclingAnalysis data={insights.cycling} />
        </section>
      )}

      {/* ── P2: Calendar Heatmap ──────────────────────────────── */}
      {insights.heatmap.length > 0 && (
        <section className="mb-8">
          <Card>
            <h2 className="mb-1 text-lg font-semibold">Visão geral — 90 dias</h2>
            <p className="mb-4 text-[11px] text-muted">
              Cada quadrado representa um dia. Cores indicam a intensidade — toque ou passe o mouse para ver detalhes.
            </p>
            <div className="space-y-5">
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground/70">Humor (1=deprimido, 3=estável, 5=elevado)</p>
                <CalendarHeatmap data={insights.heatmap} metric="mood" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-foreground/70">Sono (verde=7-9h ideal, vermelho=pouco, azul=excesso)</p>
                <CalendarHeatmap data={insights.heatmap} metric="sleep" />
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* ── P2: Seasonality ────────────────────────────────────── */}
      {insights.seasonality && insights.seasonality.monthlyMood.length >= 2 && (
        <section className="mb-8">
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Sazonalidade
            </h2>
            <div className="flex items-end gap-1">
              {insights.seasonality.monthlyMood.map((m) => {
                const names = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const heightPct = ((m.avgMood - 1) / 4) * 100;
                const isPeak = insights.seasonality!.peakMonths.includes(m.month);
                const isTrough = insights.seasonality!.troughMonths.includes(m.month);
                return (
                  <div key={m.month} className="flex flex-1 flex-col items-center">
                    <div className="relative mb-1 w-full" style={{ height: "60px" }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t ${
                          isPeak ? "bg-amber-500" : isTrough ? "bg-blue-500" : "bg-gray-500"
                        }`}
                        style={{ height: `${Math.max(10, heightPct)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted">{names[m.month]}</span>
                    <span className="text-[8px] text-muted tabular-nums">{m.avgMood.toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
            {insights.seasonality.description && (
              <p className="mt-3 text-xs text-muted">
                {insights.seasonality.description}
              </p>
            )}
            <p className="mt-2 text-center text-[10px] text-muted">
              Referência: Kessing (2004), Copenhagen. Sazonalidade é comum no bipolar.
              Não constitui diagnóstico.
            </p>
          </Card>
        </section>
      )}

      {/* ── Safety Nudge (when risk is high) ──────────────────────── */}
      {insights.risk && insights.risk.level === "atencao_alta" && (
        <div className="mb-8">
          <SafetyNudge riskLevel={insights.risk.level} />
        </div>
      )}

      {/* ── Quick links to new features ─────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Acompanhamento avançado</h2>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Link href="/avaliacao-semanal" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors">
              <p className="text-sm font-medium">Avaliação Semanal</p>
              <p className="mt-1 text-[11px] text-muted">
                ASRM + PHQ-9 + FAST — escalas validadas
              </p>
            </Card>
          </Link>
          <Link href="/life-chart" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors">
              <p className="text-sm font-medium">Life Chart</p>
              <p className="mt-1 text-[11px] text-muted">
                Eventos significativos — NIMH simplificado
              </p>
            </Card>
          </Link>
          <Link href="/cognitivo" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors">
              <p className="text-sm font-medium">Microtarefas Cognitivas</p>
              <p className="mt-1 text-[11px] text-muted">
                Tempo de reação + span de dígitos
              </p>
            </Card>
          </Link>
          <Link href="/circadiano" className="block">
            <Card className="h-full hover:border-primary/50 transition-colors">
              <p className="text-sm font-medium">Ritmo Circadiano</p>
              <p className="mt-1 text-[11px] text-muted">
                Dark therapy + cronótipo + luz
              </p>
            </Card>
          </Link>
        </div>
      </section>

      <p className="text-center text-xs text-muted mt-4">
        Baseado em pesquisas do PROMAN/USP (Prof. Beny Lafer), protocolos IPSRT e critérios do DSM-5.
        Escalas ASRM (Altman), PHQ-9 (Kroenke), FAST (Vieta). Não substitui avaliação profissional.
      </p>
    </div>
  );
}
