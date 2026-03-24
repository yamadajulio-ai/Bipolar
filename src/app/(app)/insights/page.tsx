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
import { HeatmapWithJournal } from "@/components/insights/HeatmapWithJournal";
import { Sparkline } from "@/components/insights/Sparkline";
import { NarrativeSection } from "@/components/insights/NarrativeSection";
import { InsightsTabs } from "@/components/insights/InsightsTabs";
import { ContextualFeedbackButtons } from "@/components/feedback/ContextualFeedbackButtons";
import { SpendingMoodInsightCard } from "@/components/insights/SpendingMoodInsightCard";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const maxDuration = 30;

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

/* ── Insight Card wrapper: "O que vimos" → "O que pode significar" → "O que fazer" ── */
function InsightCard({
  title,
  icon,
  what,
  meaning,
  action,
  variant = "neutral",
  children,
}: {
  title: string;
  icon?: string;
  what: string;
  meaning?: string;
  action?: string;
  variant?: "neutral" | "positive" | "warning" | "danger";
  children?: React.ReactNode;
}) {
  const borderColors = {
    neutral: "border-l-border",
    positive: "border-l-green-500",
    warning: "border-l-amber-500",
    danger: "border-l-red-500",
  };
  return (
    <Card className={`border-l-4 ${borderColors[variant]}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {icon && <span className="text-base">{icon}</span>}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm">{what}</p>
      {meaning && (
        <p className="mt-1.5 text-xs text-muted">
          <span className="font-medium">O que pode significar:</span> {meaning}
        </p>
      )}
      {action && (
        <p className="mt-1.5 text-xs text-primary font-medium">
          → {action}
        </p>
      )}
      {children}
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
  const today = now.toLocaleDateString("sv-SE", { timeZone: TZ });
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

  const [allSleepLogs, allEntries, rawPlannerBlocks, financialTxs, journalEntries90] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoff90Str } },
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
    // Journal entries for heatmap day detail (90 days, no content in server logs)
    prisma.journalEntry.findMany({
      where: { userId: session.userId, entryDateLocal: { gte: cutoff90Str } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        type: true,
        content: true,
        zoneAtCapture: true,
        mixedAtCapture: true,
        snapshotSource: true,
        entryDateLocal: true,
        createdAt: true,
      },
    }),
  ]);

  const entries = allEntries.filter((e) => e.date >= cutoff30Str);

  const sleepLogsForInsights = allSleepLogs.filter(
    (l) => l.date >= cutoff30Str && l.totalHours >= 2 && !l.excluded,
  );

  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks.map((b) => {
    const d = new Date(b.startAt);
    return {
      date: d.toLocaleDateString("sv-SE", { timeZone: TZ }),
      timeHHMM: d.toLocaleTimeString("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }),
      category: b.category,
    };
  });

  const allSleepLogsFiltered = allSleepLogs.filter((l) => !l.excluded);
  const insights = computeInsights(sleepLogsForInsights, entries, [], plannerBlocks, now, TZ, allEntries, allSleepLogsFiltered, financialTxs);

  const lastNights = allSleepLogs.filter((l) => l.totalHours > 0).slice(-nightsToShow).reverse();

  // ── Derived values for Layer 1 summary cards ──
  const sleepVariant = insights.sleep.avgDurationColor === "green" ? "positive" as const
    : insights.sleep.avgDurationColor === "red" ? "danger" as const
    : insights.sleep.avgDurationColor === "yellow" ? "warning" as const
    : "neutral" as const;

  const moodVariant = insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 3 ? "danger" as const
    : insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 2 ? "warning" as const
    : entries.length > 0 ? "positive" as const
    : "neutral" as const;

  const medVariant = insights.mood.medicationAdherence !== null
    ? insights.mood.medicationAdherence >= 90 ? "positive" as const
      : insights.mood.medicationAdherence >= 80 ? "warning" as const
      : "danger" as const
    : "neutral" as const;

  // Personal sleep baseline: median of last 30 nights (same window as /sono — 14+ needed), otherwise 8h clinical default
  const realSleepLogs30 = allSleepLogs.filter((l) => l.date >= cutoff30Str && l.totalHours >= 2 && !l.excluded);
  const personalSleepBaseline = realSleepLogs30.length >= 14
    ? (() => {
        const sorted = realSleepLogs30.map((l) => l.totalHours).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })()
    : 8;
  const sleepDeviation = insights.sleep.avgDuration !== null
    ? Math.round((insights.sleep.avgDuration - personalSleepBaseline) * 60)
    : null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="mb-1 text-2xl font-bold">Insights</h1>
      <p className="mb-4 text-xs text-muted">
        Baseado em pesquisas clínicas e protocolos de estabilidade · Não substitui avaliação profissional
      </p>

      {/* ── Empty state for new users ──────── */}
      {entries.length < 3 && sleepLogsForInsights.length < 3 && (
        <Card className="mb-6 text-center py-8">
          <div className="text-4xl mb-3">📊</div>
          <h2 className="text-lg font-semibold mb-2">Seus insights estão quase prontos</h2>
          <p className="text-sm text-muted mb-4 max-w-sm mx-auto">
            Registre pelo menos <strong>3 dias</strong> de humor e sono para que o app consiga identificar seus padrões.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/checkin"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
            >
              Fazer check-in
            </Link>
            <Link
              href="/sono/novo"
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-alt"
            >
              Registrar sono
            </Link>
          </div>
          <p className="text-[10px] text-muted mt-4">
            {entries.length}/3 check-ins · {sleepLogsForInsights.length}/3 registros de sono
          </p>
        </Card>
      )}

      {/* ── Safety Nudge (always on top when risk is high or bipolar triggers active) ──────── */}
      {(insights.risk?.level === "atencao_alta" || insights.thermometer?.mixedFeatures) && (
        <div className="mb-6">
          <SafetyNudge
            riskLevel={insights.risk?.level}
            bipolarContext={{
              mixedFeatures: insights.thermometer?.mixedFeatures ?? false,
              mixedStrength: insights.thermometer?.mixedStrength ?? null,
              consecutiveShortSleep: (() => {
                const match = insights.risk?.factors.find(f => f.includes("noites curtas seguidas"));
                if (match) { const num = parseInt(match, 10); return isNaN(num) ? 0 : num; }
                return 0;
              })(),
              maniaSignsActive: insights.thermometer?.factors.filter(f =>
                ["pensamentos acelerados", "gastos impulsivos", "energia excessiva", "planos grandiosos", "agitação", "sono reduzido"].some(s => f.toLowerCase().includes(s))
              ) ?? [],
              riskFactors: insights.risk?.factors ?? [],
            }}
          />
        </div>
      )}

      <InsightsTabs>
        {/* ════════════════════════════════════════════════════════
            LAYER 1: AGORA — Seu estado atual
            Apenas 4-5 cards resumo + termômetro + alertas
           ════════════════════════════════════════════════════════ */}
        <div>
          {/* Termômetro de Humor */}
          {insights.thermometer && (() => {
            const { maniaScore: _, depressionScore: __, ...safeThermometer } = insights.thermometer;
            return (
              <div className="mb-6">
                <MoodThermometer data={safeThermometer} />
              </div>
            );
          })()}

          {/* Status Geral */}
          {insights.risk && (
            <Card className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-semibold">Status Geral</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
                  insights.risk.level === "ok"
                    ? "bg-green-100 border-green-300 text-green-800"
                    : insights.risk.level === "atencao"
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "bg-red-100 border-red-300 text-red-800"
                }`}>
                  {insights.risk.level === "ok" ? "Estável" : insights.risk.level === "atencao" ? "Atenção" : "Atenção alta"}
                </span>
              </div>
              {insights.risk.factors.length > 0 && (
                <ul className="space-y-1">
                  {insights.risk.factors.slice(0, 4).map((f, i) => {
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
                Indicador educacional baseado nos seus dados — não substitui avaliação profissional.
              </p>
            </Card>
          )}

          {/* Combined Patterns (clinical alerts) */}
          {insights.combinedPatterns.length > 0 && (
            <div className="mb-4 space-y-2">
              {insights.combinedPatterns.map((p, i) => (
                <Alert key={i} variant={p.variant}>
                  <p className="font-medium text-sm">{p.title}</p>
                  <p className="mt-1 text-xs opacity-90">{p.message}</p>
                </Alert>
              ))}
            </div>
          )}

          {/* AI Narrative */}
          <div className="mb-6">
            <ErrorBoundary name="NarrativeSection">
              <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-alt h-32" />}>
                <NarrativeSection />
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* ── 4 Summary Cards: estado atual traduzido ─────── */}
          <h2 className="text-base font-semibold mb-3">Seu estado agora</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
            {/* Sono */}
            <InsightCard
              title="Sono"
              icon="🌙"
              variant={sleepVariant}
              what={insights.sleep.avgDuration !== null
                ? `Média de ${formatSleepDuration(insights.sleep.avgDuration)} por noite`
                : "Registre seu sono para ativar insights"
              }
              meaning={sleepDeviation !== null
                ? (() => {
                    const avgH = insights.sleep.avgDuration!;
                    const belowClinical = avgH < 7;
                    if (sleepDeviation === 0 && !belowClinical) {
                      return "Dentro do esperado para estabilidade";
                    }
                    const parts: string[] = [];
                    if (sleepDeviation !== 0) {
                      parts.push(sleepDeviation > 0
                        ? `${Math.abs(sleepDeviation)}min acima do seu padrão — observe se há sinais de depressão`
                        : `${Math.abs(sleepDeviation)}min abaixo do seu padrão — sono curto pode preceder episódios`);
                    }
                    if (belowClinical) {
                      const deficit = Math.round((7 - avgH) * 60);
                      parts.push(`Média abaixo das 7h recomendadas (faltam ${deficit}min)`);
                    }
                    return parts.join(". ");
                  })()
                : undefined
              }
              action={insights.sleep.avgDuration === null
                ? "Registre seu sono para ativar alertas"
                : insights.sleep.sleepTrend === "down" ? "Priorize o horário de dormir hoje"
                : undefined
              }
            >
              {insights.heatmap.length >= 7 && (
                <div className="mt-2">
                  <Sparkline
                    data={insights.heatmap.slice(-14).map((d) => d.sleepHours)}
                    color={sleepVariant === "positive" ? "#22c55e" : sleepVariant === "warning" ? "#f59e0b" : "#ef4444"}
                    baseline={personalSleepBaseline}
                    min={4}
                    max={12}
                  />
                </div>
              )}
            </InsightCard>

            {/* Humor */}
            <InsightCard
              title="Humor"
              icon="🧠"
              variant={moodVariant}
              what={insights.mood.moodHeadline ?? (entries.length > 0 ? "Humor registrado" : "Faça check-ins para ativar o monitoramento")}
              meaning={insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 3
                ? "Oscilação ampla — comum antes de episódios"
                : insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 2
                  ? "Oscilação moderada — mantenha a rotina"
                  : entries.length > 0 ? "Humor estável nos últimos dias" : undefined
              }
              action={entries.length === 0 ? "Faça check-in para ativar monitoramento" : undefined}
            >
              {insights.heatmap.length >= 7 && (
                <div className="mt-2">
                  <Sparkline
                    data={insights.heatmap.slice(-14).map((d) => d.mood)}
                    color="#527a6e"
                    baseline={3}
                    min={1}
                    max={5}
                  />
                </div>
              )}
            </InsightCard>


            {/* Medicação */}
            <InsightCard
              title="Medicação"
              icon="💊"
              variant={medVariant}
              what={insights.mood.medicationAdherence !== null
                ? `Adesão: ${insights.mood.medicationAdherence}% nos últimos 30 dias`
                : "Registre sua medicação para acompanhar a adesão"
              }
              meaning={insights.mood.medicationAdherence !== null
                ? insights.mood.medicationAdherence >= 90 ? "Boa adesão — fator protetor importante"
                  : insights.mood.medicationAdherence >= 80 ? "Adesão moderada — cada dose conta"
                  : "Adesão baixa — converse com seu médico sobre dificuldades"
                : undefined
              }
              action={insights.mood.medicationAdherence !== null && insights.mood.medicationAdherence < 80
                ? "Considere usar o lembrete diário"
                : undefined
              }
            />
          </div>

          {/* Warning signs summary */}
          {insights.mood.topWarningSigns.length > 0 && (
            <Card className="mb-4 border-l-4 border-l-amber-500">
              <h3 className="text-sm font-semibold mb-1">Sinais de alerta recentes</h3>
              <ul className="space-y-0.5">
                {insights.mood.topWarningSigns.map((sign) => (
                  <li key={sign.key} className="text-xs">
                    ⚠️ {sign.label} <span className="text-muted">({sign.count}x nos últimos 7 dias)</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-muted italic">
                Sinais de alerta frequentes podem indicar uma fase se aproximando. Converse com seu profissional de saúde.
              </p>
            </Card>
          )}

          {/* Sleep and mood alerts */}
          <AlertList alerts={[...insights.sleep.alerts, ...insights.mood.alerts]} />
        </div>

        {/* ════════════════════════════════════════════════════════
            LAYER 2: PADRÕES — Tendências e histórico
            Métricas detalhadas, heatmap, gráficos, ritmo social
           ════════════════════════════════════════════════════════ */}
        <div>
          {/* ── Seu Sono (detalhado) ──────────────────────── */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🌙</span>
              <h2 className="text-lg font-semibold">Padrões de Sono</h2>
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
              Alterações de sono frequentemente precedem mudanças de humor em dias ou semanas.
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              {/* Média */}
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

              {/* Variabilidade */}
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

              {/* Ponto médio */}
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

            <div className="mb-2 flex items-center gap-2">
              <ConfidenceBadge confidence={insights.sleep.dataConfidence} />
              <span className="text-[10px] text-muted">
                {insights.sleep.recordCount} noites registradas
              </span>
            </div>

            <AlertList alerts={insights.sleep.alerts} />
          </section>

          {/* ── Humor detalhado ───────────────────────── */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🧠</span>
              <h2 className="text-lg font-semibold">Padrões de Humor</h2>
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
                  Seus check-ins diários vão gerar tendências e alertas aqui.
                  Comece registrando como você se sente.
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

          {/* ── P2: Dynamic ordering — "strong" spending card rises above mood/sleep chart ── */}
          {insights.spendingMood.state === "strong" && (
            <section className="mb-8">
              <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-alt h-24" />}>
                <SpendingMoodInsightCard data={insights.spendingMood} />
              </Suspense>
            </section>
          )}

          {/* ── Gráfico Humor e Sono ──────────────────── */}
          {insights.chart.chartData.length >= 3 && (
            <section className="mb-8">
              <Card>
                <h2 className="mb-3 text-lg font-semibold">Humor e Sono — 30 dias</h2>
                <Suspense fallback={<div className="animate-pulse rounded bg-surface-alt h-48" />}>
                  <InsightsCharts data={insights.chart.chartData} />
                </Suspense>
              </Card>
            </section>
          )}

          {/* ── Humor e Gastos (spending × mood insight) — watch/learning/noSignal stay here ── */}
          {insights.spendingMood.state !== "hidden" && insights.spendingMood.state !== "strong" && (
            <section className="mb-8">
              <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-alt h-24" />}>
                <SpendingMoodInsightCard data={insights.spendingMood} />
              </Suspense>
            </section>
          )}

          {/* ── Heatmap 90 dias + Diário integrado ──────── */}
          {insights.heatmap.length > 0 && (
            <section className="mb-8">
              <HeatmapWithJournal
                heatmapData={insights.heatmap}
                diaryEntries={allEntries.map((e) => ({
                  date: e.date,
                  mood: e.mood,
                  energyLevel: e.energyLevel,
                  anxietyLevel: e.anxietyLevel,
                  irritability: e.irritability,
                  sleepHours: e.sleepHours,
                  tookMedication: e.tookMedication,
                  note: e.note,
                }))}
                journalEntries={journalEntries90.map((j) => ({
                  id: j.id,
                  type: j.type,
                  content: j.content,
                  zoneAtCapture: j.zoneAtCapture,
                  mixedAtCapture: j.mixedAtCapture,
                  snapshotSource: j.snapshotSource,
                  createdAt: j.createdAt.toISOString(),
                }))}
              />
            </section>
          )}

          {/* ── Histórico de noites ──────────────────── */}
          {lastNights.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  Histórico de Sono
                  <span className="ml-1.5 text-xs font-normal text-muted">
                    ({lastNights.length} {lastNights.length === 1 ? "registro" : "registros"})
                  </span>
                </h2>
                <Suspense>
                  <NightHistorySelector />
                </Suspense>
              </div>
              <div className="space-y-2">
                {lastNights.map((log) => (
                  <SleepHistoryCard key={log.id} log={log} />
                ))}
              </div>
            </section>
          )}

          {/* ── Sazonalidade ────────────────────────────── */}
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
                  <p className="mt-3 text-xs text-muted">{insights.seasonality.description}</p>
                )}
              </Card>
            </section>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════
            LAYER 3: AVANÇADO — Correlações, ciclagem, ferramentas
            Conteúdo técnico, metodologia, links p/ avaliações
           ════════════════════════════════════════════════════════ */}
        <div>
          {/* ── Correlações ────────────────────────────── */}
          {insights.chart.chartData.length >= 3 && (insights.chart.correlation || insights.chart.lagCorrelation) && (
            <section className="mb-8">
              <Card>
                <h2 className="mb-3 text-lg font-semibold">Correlações Sono ↔ Humor</h2>
                <p className="mb-3 text-xs text-muted">
                  Mostra se mudanças no sono estão associadas a mudanças no humor. Correlação não prova causa.
                </p>
                <div className="space-y-2 rounded-lg bg-surface-alt p-3">
                  {insights.chart.correlation && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Sono → Humor (mesmo dia)</span>
                        <p className="text-[10px] text-muted">Quando durmo mais, meu humor tende a...</p>
                      </div>
                      <CorrelationBadge result={insights.chart.correlation} />
                    </div>
                  )}
                  {insights.chart.lagCorrelation && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">Sono ontem → Humor hoje</span>
                        <p className="text-[10px] text-muted">O sono de ontem influencia como me sinto hoje?</p>
                      </div>
                      <CorrelationBadge result={insights.chart.lagCorrelation} />
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[10px] text-muted italic">
                  Método estatístico de correlação por ranking. Baseado em {insights.chart.correlation?.n ?? insights.chart.lagCorrelation?.n ?? 0} dias de dados.
                  Correlações fracas são comuns com poucos dados.
                </p>
              </Card>
            </section>
          )}

          {/* ── Predição de Episódio ──────────────────── */}
          {insights.prediction && (insights.prediction.maniaRisk > 0 || insights.prediction.depressionRisk > 0) && (
            <section className="mb-8">
              <ErrorBoundary name="EpisodePrediction">
                <Suspense fallback={<div className="animate-pulse rounded-xl bg-surface-alt h-32" />}>
                  <EpisodePrediction data={insights.prediction} />
                </Suspense>
              </ErrorBoundary>
            </section>
          )}

          {/* ── Análise de Ciclagem ──────────────────── */}
          {insights.cycling && insights.cycling.episodes.length > 0 && (
            <section className="mb-8">
              <CyclingAnalysis data={insights.cycling} />
            </section>
          )}

          {/* ── Ferramentas de Acompanhamento ─────────── */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold">Ferramentas de Acompanhamento</h2>
            <p className="mb-3 text-xs text-muted">
              Escalas validadas e ferramentas complementares para um acompanhamento mais detalhado.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Link href="/avaliacao-semanal" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <p className="text-sm font-medium">Avaliação Semanal</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Questionários validados para mania e depressão
                  </p>
                </Card>
              </Link>
              <Link href="/life-chart" className="block">
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <p className="text-sm font-medium">Life Chart</p>
                  <p className="mt-1 text-[11px] text-muted">
                    Registre eventos significativos da sua vida
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

          {/* ── Metodologia ────────────────────────────── */}
          <section className="mb-8">
            <Card className="bg-surface-alt">
              <h2 className="mb-2 text-sm font-semibold">Sobre a metodologia</h2>
              <div className="space-y-2 text-xs text-muted">
                <p>
                  <span className="font-medium text-foreground/70">Termômetro de humor:</span> Calcula uma pontuação de mania e depressão (0-100) usando uma média que dá mais peso aos dias recentes.
                  Divide em 5 zonas, de depressão severa até mania. Detecta sinais mistos (humor e energia em direções opostas) quando ambas as pontuações estão altas.
                </p>
                <p>
                  <span className="font-medium text-foreground/70">Indicador de risco:</span> Combina seus dados de sono, humor, medicação, sinais de alerta e gastos para estimar seu estado geral.
                  Não é um instrumento diagnóstico — serve como guia educacional para você e seu profissional.
                </p>
                <p>
                  <span className="font-medium text-foreground/70">Correlações:</span> Usamos um método estatístico que mede se duas coisas variam juntas (ex: sono e humor).
                  Com menos de 14 dias de dados, a força máxima mostrada é &quot;fraca&quot; por precaução.
                </p>
                <p>
                  <span className="font-medium text-foreground/70">Ciclagem Rápida:</span> Detecta se houve 4 ou mais episódios em 12 meses (critério diagnóstico internacional).
                  Episódios identificados por humor consistentemente alto ou baixo por 2+ dias seguidos.
                </p>
                <p>
                  Referências: PROMAN/USP, IPSRT (Frank, 2005), BAP 2016, CANMAT, DSM-5, ASRM (Altman), PHQ-9 (Kroenke).
                  <strong> Não substitui avaliação profissional.</strong>
                </p>
              </div>
            </Card>
          </section>
        </div>
      </InsightsTabs>

      <p className="text-center text-xs text-muted mt-4 mb-2">
        Baseado em pesquisas clínicas e protocolos internacionais de estabilidade. Não substitui avaliação profissional.
      </p>

      <div className="text-center mb-8">
        <ContextualFeedbackButtons
          contextKey={`insight:${today}`}
          question="Esta análise foi útil?"
        />
      </div>
    </div>
  );
}
