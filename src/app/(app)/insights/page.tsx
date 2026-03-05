import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { InsightsCharts } from "@/components/planner/InsightsCharts";
import { NightHistorySelector } from "@/components/insights/NightHistorySelector";
import { computeInsights, formatSleepDuration, regularityScoreFromVariance } from "@/lib/insights/computeInsights";
import { MoodThermometer } from "@/components/insights/MoodThermometer";
import type { ClinicalAlert, PlannerBlockInput, CombinedPattern, RiskScore } from "@/lib/insights/computeInsights";
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
  return "Fora do ideal";
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
              <li key={i} className={`text-xs flex items-start gap-1.5 ${isProtective ? "text-green-700 dark:text-green-400" : "text-muted"}`}>
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
  const nightsToShow = Math.min(90, Math.max(7, Number(params.noites) || 15));

  // Fetch 90 days of sleep for history, 30 days for insights computation
  const cutoff90 = new Date(now);
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff90Str = cutoff90.toLocaleDateString("sv-SE", { timeZone: TZ });

  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toLocaleDateString("sv-SE", { timeZone: TZ });

  const [allSleepLogs, entries, rhythms, rawPlannerBlocks] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff90Str } },
      orderBy: { date: "asc" },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
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
  ]);

  // For insights computation: last 30 days, only real sleep (>= 1h). Under 1h = nap.
  const sleepLogsForInsights = allSleepLogs.filter(
    (l) => l.date >= cutoff30Str && l.totalHours >= 1,
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

  const insights = computeInsights(sleepLogsForInsights, entries, rhythms, plannerBlocks, now, TZ);

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
          <p className={`mb-2 text-sm font-medium ${
            insights.sleep.sleepHeadline.startsWith("Atenção")
              ? "text-amber-700 dark:text-amber-400"
              : "text-green-700 dark:text-green-400"
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
            <p className="text-[11px] text-muted leading-tight">Média de sono</p>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.avgDuration !== null
                ? formatSleepDuration(insights.sleep.avgDuration)
                : "—"}
            </p>
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
            <p className="text-[11px] text-muted leading-tight">Regularidade</p>
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
            <p className="text-[11px] text-muted leading-tight">Variabilidade</p>
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
            <p className="text-[11px] text-muted leading-tight">Tendência</p>
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
            <p className="text-[11px] text-muted leading-tight">Ponto médio</p>
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
            <p className="text-[11px] text-muted leading-tight">Qualidade</p>
            <p className="text-xl font-bold mt-0.5 tabular-nums">
              {insights.sleep.avgQuality !== null ? `${insights.sleep.avgQuality}%` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted">wearable (0-100)</p>
          </Card>
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
              {lastNights.map((log) => {
                const isNap = log.totalHours < 1;
                const isShort = !isNap && log.totalHours < 6;
                const isGood = log.totalHours >= 7;
                const durationPct = Math.min(100, Math.max(8, (log.totalHours / 10) * 100));
                const dateObj = new Date(log.date + "T12:00:00");
                const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
                const dateLabel = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 ${
                      isNap
                        ? "border-purple-200 bg-purple-50/40 dark:border-purple-900/30 dark:bg-purple-950/20"
                        : isShort
                          ? "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20"
                          : isGood
                            ? "border-green-200/50 bg-green-50/30 dark:border-green-900/20 dark:bg-green-950/10"
                            : "border-border bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize">{weekday}</span>
                        <span className="text-xs text-muted">{dateLabel}</span>
                        {isNap && (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            cochilo
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${
                        isNap ? "text-purple-600 dark:text-purple-400"
                          : isShort ? "text-red-600 dark:text-red-400"
                          : isGood ? "text-green-700 dark:text-green-400"
                          : "text-foreground"
                      }`}>
                        {formatSleepDuration(log.totalHours)}
                      </span>
                    </div>

                    {/* Duration bar */}
                    <div className="h-1.5 w-full rounded-full bg-black/5 dark:bg-white/5 mb-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          isNap ? "bg-purple-400" : isShort ? "bg-red-400" : isGood ? "bg-green-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${durationPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>{log.bedtime} → {log.wakeTime}</span>
                      <div className="flex items-center gap-3">
                        {log.hrv != null && (
                          <span>HRV <strong className="text-foreground">{log.hrv}</strong>ms</span>
                        )}
                        {log.heartRate != null && (
                          <span>FC <strong className="text-foreground">{log.heartRate}</strong>bpm</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
          <p className={`mb-2 text-sm font-medium ${
            insights.mood.moodHeadline.includes("elevado") || insights.mood.moodHeadline.includes("oscilação")
              ? "text-amber-700 dark:text-amber-400"
              : insights.mood.moodHeadline.includes("queda")
                ? "text-blue-700 dark:text-blue-400"
                : "text-green-700 dark:text-green-400"
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
                <p className="text-[11px] text-muted leading-tight">Tendência (7 dias)</p>
                <p className="text-xl font-bold mt-0.5">
                  {insights.mood.moodTrend === "up" ? "↑ Subindo"
                    : insights.mood.moodTrend === "down" ? "↓ Caindo"
                    : insights.mood.moodTrend === "stable" ? "→ Estável"
                    : "—"}
                </p>
              </Card>

              {/* Variabilidade (amplitude) */}
              <Card className={`border-l-4 ${
                insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 3
                  ? "border-l-red-500"
                  : insights.mood.moodAmplitude !== null && insights.mood.moodAmplitude >= 2
                    ? "border-l-amber-500"
                    : "border-l-border"
              }`}>
                <p className="text-[11px] text-muted leading-tight">Oscilação (7 dias)</p>
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
                <p className="text-[11px] text-muted leading-tight">Medicação</p>
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
                <p className="text-[11px] text-muted leading-tight">Sinais de alerta</p>
                {insights.mood.topWarningSigns.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {insights.mood.topWarningSigns.map((sign) => (
                      <li key={sign.key} className="text-[11px] leading-tight">
                        {sign.label} <span className="text-muted tabular-nums">({sign.count}x)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">Nenhum</p>
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
        <p className="mb-4 text-[11px] text-muted">
          Horários regulares para atividades-chave protegem contra episódios (IPSRT).
        </p>

        {anchorsWithData.length > 0 ? (
          <Card className="mb-4">
            {/* Regularidade geral */}
            {insights.rhythm.overallRegularity !== null && (
              <div className="mb-4">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Regularidade geral</span>
                  <span className="text-sm font-bold">{insights.rhythm.overallRegularity}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      insights.rhythm.overallRegularity >= 70 ? "bg-green-400"
                        : insights.rhythm.overallRegularity >= 40 ? "bg-amber-400"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${insights.rhythm.overallRegularity}%` }}
                  />
                </div>
              </div>
            )}

            {/* Anchors with regularity score bars (bigger = more regular) */}
            <div className="space-y-3">
              {anchorsWithData.map(([key, anchor]) => {
                const score = anchor.regularityScore ?? 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-40 flex-shrink-0">
                      <span className="text-sm">{anchor.label}</span>
                      {anchor.source && (
                        <span className="ml-1 text-[10px] text-muted">
                          ({SOURCE_LABELS[anchor.source]})
                        </span>
                      )}
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-gray-200">
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
            {insights.chart.correlationNote && (
              <p className="mt-3 text-xs text-muted italic">
                {insights.chart.correlationNote}
              </p>
            )}
            {insights.chart.lagCorrelationNote && (
              <p className="mt-1 text-xs text-muted italic">
                {insights.chart.lagCorrelationNote}
              </p>
            )}
          </Card>
        </section>
      )}

      <p className="text-center text-xs text-muted mt-4">
        Baseado em pesquisas do PROMAN/USP (Prof. Beny Lafer), protocolos IPSRT e critérios do DSM-5.
        Não substitui avaliação profissional.
      </p>
    </div>
  );
}
