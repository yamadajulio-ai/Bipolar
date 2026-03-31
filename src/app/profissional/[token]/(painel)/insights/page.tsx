import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { InsightsChartsLazy as InsightsCharts } from "@/components/planner/InsightsChartsLazy";
import { NightHistorySelector } from "@/components/insights/NightHistorySelector";
import { computeInsights, formatSleepDuration } from "@/lib/insights/computeInsights";
import { SleepDayGroup } from "@/components/insights/SleepHistoryCard";
import { aggregateSleepByDay, isMainSleep } from "@/lib/insights/stats";
import { MoodThermometer } from "@/components/insights/MoodThermometer";
import type { ClinicalAlert, PlannerBlockInput, DataConfidence, CorrelationResult } from "@/lib/insights/computeInsights";
import { SafetyNudge } from "@/components/insights/SafetyNudge";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Suspense } from "react";

export const maxDuration = 30;

/** Feature flag: set to true to re-enable financeiro in v1.1 */
const SHOW_FINANCEIRO = false;

const TZ = "America/Sao_Paulo";

function colorToCardBorder(color: "green" | "yellow" | "red"): string {
  if (color === "green") return "border-l-green-500";
  if (color === "yellow") return "border-l-amber-500";
  return "border-l-red-500";
}

function ConfidenceBadge({ confidence }: { confidence: DataConfidence }) {
  const config: Record<DataConfidence, { label: string; color: string }> = {
    baixa: { label: "Poucos dados", color: "bg-danger-bg-subtle text-danger-fg border border-danger-border" },
    media: { label: "Dados moderados", color: "bg-warning-bg-subtle text-warning-fg border border-warning-border" },
    alta: { label: "Dados suficientes", color: "bg-success-bg-subtle text-success-fg border border-success-border" },
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
    fraca: "text-info-fg",
    moderada: "text-warning-fg",
    forte: "text-danger-fg",
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

export default async function ViewerInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ noites?: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const userId = session.patientUserId;
  const now = new Date();
  const sp = await searchParams;
  const noitesStr = Array.isArray(sp.noites) ? sp.noites[0] : sp.noites;
  const nightsToShow = Math.min(90, Math.max(7, Number(noitesStr) || 15));

  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90Str = cutoff90.toLocaleDateString("sv-SE", { timeZone: TZ });
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

  const [allSleepLogs, allEntries, rawPlannerBlocks, financialTxs] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: { userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.plannerBlock.findMany({
      where: { userId, startAt: { gte: cutoff30 }, category: { in: ["social", "trabalho", "refeicao"] } },
      select: { startAt: true, category: true },
      orderBy: { startAt: "asc" },
    }),
    SHOW_FINANCEIRO ? prisma.financialTransaction.findMany({
      where: { userId, date: { gte: cutoff30Str } },
      select: { date: true, amount: true },
    }) : Promise.resolve([]),
  ]);

  const entries = allEntries.filter((e) => e.date >= cutoff30Str);
  const sleepLogsForInsights = aggregateSleepByDay(
    allSleepLogs.filter((l) => l.date >= cutoff30Str && l.totalHours >= 2 && !l.excluded && isMainSleep(l)),
  );

  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks.map((b) => {
    const d = new Date(b.startAt);
    return {
      date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
      timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
      category: b.category,
    };
  });

  const allSleepLogsFiltered = aggregateSleepByDay(allSleepLogs.filter((l) => !l.excluded));
  const insights = computeInsights(sleepLogsForInsights, entries, [], plannerBlocks, now, TZ, allEntries, allSleepLogsFiltered, SHOW_FINANCEIRO ? financialTxs : []);

  const lastNights = allSleepLogs.filter((l) => l.totalHours > 0).slice(-nightsToShow).reverse();

  // Derived variants
  // Insufficient data
  if (entries.length < 3 && sleepLogsForInsights.length < 3) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="mb-1 text-2xl font-bold">Insights</h1>
        <p className="mb-4 text-sm text-muted">Análise de {session.patientName}</p>
        <Card className="text-center py-8">
          <h2 className="text-lg font-semibold mb-2">Dados insuficientes</h2>
          <p className="text-sm text-muted max-w-sm mx-auto">
            O paciente precisa de pelo menos 3 dias de registros de humor e sono para gerar insights.
          </p>
          <p className="text-[11px] text-muted mt-4">
            {entries.length}/3 check-ins · {sleepLogsForInsights.length}/3 registros de sono
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Insights</h1>
        <p className="mb-0 text-xs text-muted">
          Análise de {session.patientName} · Baseado em pesquisas clínicas e protocolos de estabilidade
        </p>
      </div>

      {/* Safety Nudge */}
      {(insights.risk?.level === "atencao_alta" || insights.thermometer?.mixedFeatures) && (
        <SafetyNudge
          riskLevel={insights.risk?.level}
          bipolarContext={{
            mixedFeatures: insights.thermometer?.mixedFeatures ?? false,
            mixedStrength: insights.thermometer?.mixedStrength ?? null,
            consecutiveShortSleep: (() => {
              const match = insights.risk?.factors.find((f) => f.includes("noites curtas seguidas"));
              if (match) { const num = parseInt(match, 10); return isNaN(num) ? 0 : num; }
              return 0;
            })(),
            maniaSignsActive: insights.thermometer?.factors.filter((f) =>
              f.includes("energia") || f.includes("sono curto") || f.includes("irritabilidade"),
            ) ?? [],
          }}
        />
      )}

      {/* ── ESTADO ATUAL ── */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Estado Atual</h2>

        {/* Mood Thermometer */}
        {insights.thermometer && (
          <Card className="mb-4">
            <h3 className="text-sm font-semibold mb-3">Termômetro de Humor</h3>
            <MoodThermometer data={insights.thermometer} />
          </Card>
        )}

        {/* Risk Status */}
        {insights.risk && (
          <Card className="mb-4">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold">Status Geral</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                insights.risk.level === "ok"
                  ? "bg-success-bg-subtle text-success-fg border border-success-border"
                  : insights.risk.level === "atencao"
                    ? "bg-warning-bg-subtle text-warning-fg border border-warning-border"
                    : "bg-danger-bg-subtle text-danger-fg border border-danger-border"
              }`}>
                {insights.risk.level === "ok" ? "Estável"
                  : insights.risk.level === "atencao" ? "Atenção"
                  : "Atenção Alta"} — Score {insights.risk.score}
              </span>
            </div>
            {insights.risk.factors.length > 0 && (
              <ul className="space-y-1.5">
                {insights.risk.factors.map((f, i) => {
                  const isProtective = f.toLowerCase().includes("protetor") || f.toLowerCase().includes("boa adesão");
                  return (
                    <li key={i} className="text-xs flex items-start gap-1.5 text-foreground/80">
                      <span className={`mt-0.5 shrink-0 ${isProtective ? "text-success-fg" : "text-warning-fg"}`} aria-hidden="true">
                        {isProtective ? "✓" : "•"}
                      </span>
                      {f}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

        {/* Combined Patterns */}
        {insights.combinedPatterns.length > 0 && (
          <Card className="mb-4">
            <h3 className="text-sm font-semibold mb-2">Padrões Combinados</h3>
            <div className="space-y-2">
              {insights.combinedPatterns.map((p, i) => (
                <div key={i} className={`text-xs rounded-lg px-3 py-2 ${
                  p.variant === "danger" ? "bg-danger-bg-subtle text-danger-fg"
                    : p.variant === "warning" ? "bg-warning-bg-subtle text-warning-fg"
                    : "bg-info-bg-subtle text-info-fg"
                }`}>
                  <span className="font-medium">{p.title}:</span> {p.message}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Sleep */}
          <Card className={`border-l-4 ${insights.sleep.avgDurationColor ? colorToCardBorder(insights.sleep.avgDurationColor) : "border-l-border"}`}>
            <p className="text-[11px] text-muted">Sono (média)</p>
            <p className="text-xl font-bold tabular-nums">
              {insights.sleep.avgDuration !== null ? formatSleepDuration(insights.sleep.avgDuration) : "—"}
            </p>
          </Card>

          {/* Mood */}
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Humor</p>
            <p className="text-sm font-semibold mt-1">
              {insights.mood.moodHeadline ?? "—"}
            </p>
            {insights.mood.moodAmplitudeLabel && (
              <p className="text-[11px] text-muted">Oscilação: {insights.mood.moodAmplitudeLabel}</p>
            )}
          </Card>

          {/* Medication */}
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Medicação</p>
            <p className={`text-xl font-bold tabular-nums ${
              insights.mood.medicationAdherence !== null
                ? insights.mood.medicationAdherence >= 90 ? "text-success-fg"
                  : insights.mood.medicationAdherence >= 80 ? "text-warning-fg"
                  : "text-danger-fg"
                : ""
            }`}>
              {insights.mood.medicationAdherence !== null ? `${insights.mood.medicationAdherence}%` : "—"}
            </p>
          </Card>

          {/* Warning Signs */}
          {insights.mood.topWarningSigns.length > 0 && (
            <Card className="border-l-4 border-l-border">
              <p className="text-[11px] text-muted mb-1">Sinais de alerta</p>
              {insights.mood.topWarningSigns.slice(0, 3).map((s) => (
                <p key={s.key} className="text-xs text-foreground">
                  {s.label} <span className="text-muted">({s.count}x)</span>
                </p>
              ))}
            </Card>
          )}
        </div>
      </section>

      {/* ── PADRÕES DE SONO ── */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold">Padrões de Sono</h2>
          <ConfidenceBadge confidence={insights.sleep.dataConfidence} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Card className={`border-l-4 ${insights.sleep.avgDurationColor ? colorToCardBorder(insights.sleep.avgDurationColor) : "border-l-border"}`}>
            <p className="text-[11px] text-muted">Média</p>
            <p className="text-lg font-bold tabular-nums">
              {insights.sleep.avgDuration !== null ? formatSleepDuration(insights.sleep.avgDuration) : "—"}
            </p>
          </Card>
          <Card className={`border-l-4 ${insights.sleep.bedtimeVarianceColor ? colorToCardBorder(insights.sleep.bedtimeVarianceColor) : "border-l-border"}`}>
            <p className="text-[11px] text-muted">Regularidade</p>
            <p className="text-lg font-bold tabular-nums">
              {insights.sleep.bedtimeVariance !== null ? `±${insights.sleep.bedtimeVariance}min` : "—"}
            </p>
          </Card>
          <Card className={`border-l-4 ${insights.sleep.durationVariabilityColor ? colorToCardBorder(insights.sleep.durationVariabilityColor) : "border-l-border"}`}>
            <p className="text-[11px] text-muted">Variabilidade</p>
            <p className="text-lg font-bold tabular-nums">
              {insights.sleep.durationVariability !== null ? `${insights.sleep.durationVariability}h` : "—"}
            </p>
          </Card>
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Tendência</p>
            <p className="text-lg font-bold">
              {insights.sleep.sleepTrend === "up" ? "↑"
                : insights.sleep.sleepTrend === "down" ? "↓"
                : insights.sleep.sleepTrend === "stable" ? "→" : "—"}
              {insights.sleep.sleepTrendDelta !== null && ` ${insights.sleep.sleepTrendDelta > 0 ? "+" : ""}${formatSleepDuration(insights.sleep.sleepTrendDelta)}`}
            </p>
          </Card>
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Qualidade</p>
            <p className="text-lg font-bold tabular-nums">
              {insights.sleep.avgQuality !== null ? `${insights.sleep.avgQuality}%` : "—"}
            </p>
          </Card>
          {insights.sleep.socialJetLag !== null && (
            <Card className="border-l-4 border-l-border">
              <p className="text-[11px] text-muted">Social Jet Lag</p>
              <p className="text-lg font-bold tabular-nums">{insights.sleep.socialJetLag}h</p>
            </Card>
          )}
        </div>

        <AlertList alerts={insights.sleep.alerts} />

        <p className="mt-2 text-[11px] text-muted">
          {insights.sleep.recordCount} registros nos últimos 30 dias
        </p>
      </section>

      {/* ── HUMOR E SONO (GRÁFICO 30d) ── */}
      {insights.chart && insights.chart.chartData.length >= 3 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Humor e Sono — 30 dias</h2>
          <Card>
            <ErrorBoundary name="InsightsCharts">
              <Suspense fallback={<div className="h-[260px] animate-pulse rounded-lg bg-surface-alt" />}>
                <InsightsCharts data={insights.chart.chartData} />
              </Suspense>
            </ErrorBoundary>
            {insights.chart.correlationNote && (
              <p className="mt-2 text-xs text-muted">{insights.chart.correlationNote}</p>
            )}
          </Card>
        </section>
      )}

      {/* ── CORRELAÇÕES ── */}
      {insights.chart && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Correlações</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.chart.correlation && (
              <Card>
                <p className="text-[11px] text-muted mb-1">Sono ↔ Humor (mesmo dia)</p>
                <CorrelationBadge result={insights.chart.correlation} />
                <p className="text-[11px] text-muted mt-1">n={insights.chart.correlation.n} dias</p>
              </Card>
            )}
            {insights.chart.lagCorrelation && (
              <Card>
                <p className="text-[11px] text-muted mb-1">Sono ontem → Humor hoje</p>
                <CorrelationBadge result={insights.chart.lagCorrelation} />
                <p className="text-[11px] text-muted mt-1">n={insights.chart.lagCorrelation.n} dias</p>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ── PREDIÇÃO DE EPISÓDIOS ── */}
      {insights.prediction && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Risco de Episódio</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className={`border-l-4 ${
              insights.prediction.maniaRisk >= 70 ? "border-l-red-500"
                : insights.prediction.maniaRisk >= 40 ? "border-l-amber-500"
                : "border-l-green-500"
            }`}>
              <p className="text-[11px] text-muted">Risco de Mania</p>
              <p className="text-xl font-bold tabular-nums">{insights.prediction.maniaRisk}%</p>
              <p className="text-[11px] text-muted">{insights.prediction.maniaSignals.length} fatores</p>
            </Card>
            <Card className={`border-l-4 ${
              insights.prediction.depressionRisk >= 70 ? "border-l-red-500"
                : insights.prediction.depressionRisk >= 40 ? "border-l-amber-500"
                : "border-l-green-500"
            }`}>
              <p className="text-[11px] text-muted">Risco de Depressão</p>
              <p className="text-xl font-bold tabular-nums">{insights.prediction.depressionRisk}%</p>
              <p className="text-[11px] text-muted">{insights.prediction.depressionSignals.length} fatores</p>
            </Card>
          </div>
        </section>
      )}

      {/* ── CICLAGEM RÁPIDA ── */}
      {insights.cycling && insights.cycling.isRapidCycling && (
        <Card className="border-l-4 border-l-red-500">
          <h3 className="text-sm font-semibold text-danger-fg">Padrão de Ciclagem Rápida</h3>
          <p className="text-xs text-muted mt-1">
            {insights.cycling.polaritySwitches} mudanças de polaridade detectadas
            {insights.cycling.avgCycleLength !== null && ` · Ciclo médio: ${insights.cycling.avgCycleLength} dias`}
          </p>
        </Card>
      )}

      {/* ── HISTÓRICO DE SONO ── */}
      {lastNights.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Histórico de Sono</h2>
            <NightHistorySelector />
          </div>
          <SleepDayGroup logs={lastNights} readOnly />
        </section>
      )}

      {/* ── ALERTAS DE HUMOR ── */}
      <AlertList alerts={insights.mood.alerts} />

      <p className="text-center text-[10px] text-muted py-4">
        Dados gerados automaticamente pelo Suporte Bipolar.
        Indicadores educacionais — uso clínico requer interpretação profissional.
      </p>
    </div>
  );
}
