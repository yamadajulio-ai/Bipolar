import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { InsightsCharts } from "@/components/planner/InsightsCharts";
import { localDateStr } from "@/lib/dateUtils";
import { computeInsights, formatSleepDuration } from "@/lib/insights/computeInsights";
import type { ClinicalAlert, PlannerBlockInput } from "@/lib/insights/computeInsights";
import Link from "next/link";

function colorToBg(color: "green" | "yellow" | "red"): string {
  if (color === "green") return "bg-green-400";
  if (color === "yellow") return "bg-amber-400";
  return "bg-red-400";
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

export default async function InsightsPage() {
  const session = await getSession();
  const now = new Date();
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = localDateStr(cutoff30);

  const [sleepLogs, entries, rhythms, rawPlannerBlocks] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: cutoff30Str } },
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

  // Convert PlannerBlock DateTime to the format computeInsights expects
  const plannerBlocks: PlannerBlockInput[] = rawPlannerBlocks.map((b) => {
    const d = new Date(b.startAt);
    return {
      date: localDateStr(d),
      timeHHMM: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      category: b.category,
    };
  });

  const insights = computeInsights(sleepLogs, entries, rhythms, plannerBlocks);

  // Filter anchors that have data for the simplified IPSRT section
  const anchorsWithData = Object.entries(insights.rhythm.anchors)
    .filter(([, anchor]) => anchor.variance !== null);

  // Last 15 sleep logs (newest first) for the detail table
  const last15 = sleepLogs.slice(-15).reverse();

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Insights</h1>
      <p className="mb-6 text-sm text-muted">
        Análises baseadas em pesquisas do PROMAN/USP e protocolos IPSRT.
        Não substitui avaliação profissional.
      </p>

      {/* ── Seção 1: Seu Sono ───────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Seu Sono</h2>
        <p className="mb-4 text-xs text-muted">
          O sono é o marcador biológico mais importante no transtorno bipolar.
          Alterações de sono frequentemente precedem mudanças de humor.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Média de sono */}
          <Card>
            <p className="text-xs text-muted">Média de sono (30 dias)</p>
            <p className="text-2xl font-bold">
              {insights.sleep.avgDuration !== null
                ? formatSleepDuration(insights.sleep.avgDuration)
                : "—"}
            </p>
            {insights.sleep.avgDurationColor && (
              <div className={`mt-1 h-1.5 w-full rounded-full ${colorToBg(insights.sleep.avgDurationColor)}`} />
            )}
            <p className="mt-1 text-xs text-muted">
              {insights.sleep.recordCount} registros
            </p>
          </Card>

          {/* Regularidade */}
          <Card>
            <p className="text-xs text-muted">Regularidade do horário (30 dias)</p>
            <p className="text-2xl font-bold">
              {insights.sleep.bedtimeVariance !== null
                ? `±${insights.sleep.bedtimeVariance}min`
                : "—"}
            </p>
            {insights.sleep.bedtimeVarianceColor && (
              <div className={`mt-1 h-1.5 w-full rounded-full ${colorToBg(insights.sleep.bedtimeVarianceColor)}`} />
            )}
            <p className="mt-1 text-xs text-muted">
              {insights.sleep.bedtimeVariance !== null
                ? insights.sleep.bedtimeVariance <= 30 ? "Excelente"
                  : insights.sleep.bedtimeVariance <= 60 ? "Moderada"
                  : "Irregular — meta: ±30min"
                : "variação do horário de dormir"}
            </p>
          </Card>

          {/* Variabilidade da duração */}
          <Card>
            <p className="text-xs text-muted">Variabilidade da duração (30 dias)</p>
            <p className="text-2xl font-bold">
              {insights.sleep.durationVariability !== null
                ? `±${insights.sleep.durationVariability}min`
                : "—"}
            </p>
            {insights.sleep.durationVariabilityColor && (
              <div className={`mt-1 h-1.5 w-full rounded-full ${colorToBg(insights.sleep.durationVariabilityColor)}`} />
            )}
            <p className="mt-1 text-xs text-muted">
              {insights.sleep.durationVariability !== null
                ? insights.sleep.durationVariability <= 30 ? "Consistente"
                  : insights.sleep.durationVariability <= 60 ? "Moderada"
                  : "Alta — meta: ±30min"
                : "oscilação na duração noite a noite"}
            </p>
          </Card>

          {/* Tendência */}
          <Card>
            <p className="text-xs text-muted">Tendência de sono</p>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold">
                {insights.sleep.sleepTrend === "up" ? "↑"
                  : insights.sleep.sleepTrend === "down" ? "↓"
                  : insights.sleep.sleepTrend === "stable" ? "→"
                  : "—"}
              </p>
              {insights.sleep.sleepTrendDelta !== null && (
                <span className="text-sm text-muted">
                  {insights.sleep.sleepTrendDelta > 0 ? "+" : ""}
                  {formatSleepDuration(Math.abs(insights.sleep.sleepTrendDelta))}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">últimos 7 dias vs anteriores</p>
          </Card>

          {/* Ponto médio do sono */}
          <Card>
            <p className="text-xs text-muted">Ponto médio do sono (30 dias)</p>
            <p className="text-2xl font-bold">
              {insights.sleep.midpoint ?? "—"}
            </p>
            {insights.sleep.midpointTrend && (
              <div className="flex items-baseline gap-1">
                <span className="text-sm">
                  {insights.sleep.midpointTrend === "up" ? "↑ Atrasando"
                    : insights.sleep.midpointTrend === "down" ? "↓ Adiantando"
                    : "→ Estável"}
                </span>
                {insights.sleep.midpointDelta !== null && Math.abs(insights.sleep.midpointDelta) > 0 && (
                  <span className="text-xs text-muted">
                    ({insights.sleep.midpointDelta > 0 ? "+" : ""}{insights.sleep.midpointDelta}min)
                  </span>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-muted">marcador circadiano</p>
          </Card>

          {/* Qualidade */}
          <Card>
            <p className="text-xs text-muted">Qualidade do sono (30 dias)</p>
            <p className="text-2xl font-bold">
              {insights.sleep.avgQuality !== null ? `${insights.sleep.avgQuality}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted">média (0-100)</p>
          </Card>
        </div>

        <AlertList alerts={insights.sleep.alerts} />

        {/* Tabela: últimos 15 dias de sono */}
        {last15.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Últimos 15 dias</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-alt text-left text-muted">
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Dormir</th>
                    <th className="px-3 py-2 font-medium">Acordar</th>
                    <th className="px-3 py-2 font-medium">Duração</th>
                    <th className="px-3 py-2 font-medium">HRV</th>
                    <th className="px-3 py-2 font-medium">FC</th>
                  </tr>
                </thead>
                <tbody>
                  {last15.map((log) => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(log.date + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">{log.bedtime}</td>
                      <td className="px-3 py-2">{log.wakeTime}</td>
                      <td className="px-3 py-2">{formatSleepDuration(log.totalHours)}</td>
                      <td className="px-3 py-2">{log.hrv != null ? `${log.hrv}ms` : "—"}</td>
                      <td className="px-3 py-2">{log.heartRate != null ? `${log.heartRate}bpm` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Seção 2: Seu Humor ──────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-1 text-lg font-semibold">Seu Humor</h2>
        <p className="mb-4 text-xs text-muted">
          Acompanhar padrões de humor ajuda a identificar fases do transtorno
          bipolar antes que se intensifiquem.
        </p>

        {entries.length > 0 ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              {/* Tendência */}
              <Card>
                <p className="text-xs text-muted">Tendência (7 dias)</p>
                <p className="text-2xl font-bold">
                  {insights.mood.moodTrend === "up" ? "↑ Subindo"
                    : insights.mood.moodTrend === "down" ? "↓ Caindo"
                    : insights.mood.moodTrend === "stable" ? "→ Estável"
                    : "—"}
                </p>
              </Card>

              {/* Variabilidade */}
              <Card>
                <p className="text-xs text-muted">Variabilidade do humor</p>
                <p className="text-2xl font-bold">
                  {insights.mood.moodVariability !== null
                    ? insights.mood.moodVariability <= 7 ? "Baixa"
                      : insights.mood.moodVariability <= 12 ? "Moderada"
                      : "Alta"
                    : "—"}
                </p>
                {insights.mood.moodVariability !== null && (
                  <p className="mt-1 text-xs text-muted">
                    oscilação: ±{(insights.mood.moodVariability / 10).toFixed(1)} pontos
                  </p>
                )}
              </Card>

              {/* Adesão medicação */}
              <Card>
                <p className="text-xs text-muted">Adesão à medicação</p>
                <p className={`text-2xl font-bold ${
                  insights.mood.medicationAdherence !== null && insights.mood.medicationAdherence < 80
                    ? "text-amber-600" : ""
                }`}>
                  {insights.mood.medicationAdherence !== null
                    ? `${insights.mood.medicationAdherence}%`
                    : "—"}
                </p>
                <p className="mt-1 text-xs text-muted">últimos 30 dias</p>
              </Card>

              {/* Sinais de alerta */}
              <Card>
                <p className="text-xs text-muted">Sinais de alerta frequentes</p>
                {insights.mood.topWarningSigns.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {insights.mood.topWarningSigns.map((sign) => (
                      <li key={sign.key} className="text-xs">
                        {sign.label} <span className="text-muted">({sign.count}x)</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-bold">—</p>
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
        <h2 className="mb-1 text-lg font-semibold">Seu Ritmo Social</h2>
        <p className="mb-4 text-xs text-muted">
          A Terapia de Ritmos Sociais (IPSRT) mostra que manter horários regulares
          para atividades-chave protege contra episódios no transtorno bipolar.
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

            {/* Only show anchors that have data */}
            <div className="space-y-3">
              {anchorsWithData.map(([key, anchor]) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-40">
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
                      style={{ width: `${Math.min(100, (anchor.variance! / 120) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">±{anchor.variance}min</span>
                </div>
              ))}
            </div>

            {(insights.rhythm.usedSleepFallback || insights.rhythm.usedPlannerFallback) && (
              <p className="mt-3 text-xs text-muted italic">
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
