import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { SleepDayGroup } from "@/components/insights/SleepHistoryCard";
import { Sparkline } from "@/components/insights/Sparkline";
import { aggregateSleepByDay, isMainSleep } from "@/lib/insights/stats";
import { computeSleepInsights } from "@/lib/insights/sleep";
import { formatSleepDuration } from "@/lib/insights/computeInsights";

const TZ = "America/Sao_Paulo";

export default async function ViewerSonoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const userId = session.patientUserId;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: { userId, date: { gte: cutoffStr } },
    orderBy: { date: "asc" },
  });

  // Use the same pipeline as Insights: filter → aggregateByDay → computeSleepInsights
  const realLogs = logs.filter((l) => l.totalHours >= 2 && !l.excluded && isMainSleep(l));
  const aggregated = aggregateSleepByDay(realLogs);
  const sleep = computeSleepInsights(aggregated, new Date(), TZ);

  // Sparkline from aggregated daily totals (last 14 days)
  const sparklineData = aggregated.slice(-14).map((d) => d.totalHours);

  // Personal baseline (same as /sono page: median if 14+ days, else 8h)
  const personalBaseline = aggregated.length >= 14
    ? (() => {
        const sorted = aggregated.map((d) => d.totalHours).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })()
    : 8;
  const deviationMin = sleep.avgDuration !== null ? Math.round((sleep.avgDuration - personalBaseline) * 60) : null;

  const logsDesc = [...logs].reverse();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sono</h1>
        <p className="text-sm text-muted mt-1">Histórico de sono de {session.patientName}</p>
      </div>

      {/* Summary Cards — values from computeSleepInsights (same as Insights page) */}
      {sleep.recordCount >= 3 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3">
          <Card className={`border-l-4 ${
            sleep.avgDurationColor === "green" ? "border-l-green-500 dark:border-l-green-400"
              : sleep.avgDurationColor === "yellow" ? "border-l-amber-500 dark:border-l-amber-400"
              : sleep.avgDurationColor === "red" ? "border-l-red-500 dark:border-l-red-400"
              : "border-l-border"
          }`}>
            <p className="text-[11px] text-muted">Média</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold tabular-nums">
                {sleep.avgDuration !== null ? formatSleepDuration(sleep.avgDuration) : "—"}
              </p>
              {sparklineData.length >= 5 && (
                <Sparkline
                  data={sparklineData}
                  color={sleep.avgDurationColor === "green" ? "#22c55e" : "#f59e0b"}
                  baseline={personalBaseline}
                  min={4}
                  max={12}
                />
              )}
            </div>
            {deviationMin !== null && (
              <p className="text-[11px] text-muted">
                {deviationMin === 0 ? `Na média (${formatSleepDuration(personalBaseline)})`
                  : deviationMin > 0 ? `+${deviationMin}min vs média`
                  : `${deviationMin}min vs média`}
              </p>
            )}
          </Card>

          <Card className={`border-l-4 ${
            sleep.bedtimeVarianceColor === "green" ? "border-l-green-500 dark:border-l-green-400"
              : sleep.bedtimeVarianceColor === "yellow" ? "border-l-amber-500 dark:border-l-amber-400"
              : sleep.bedtimeVarianceColor === "red" ? "border-l-red-500 dark:border-l-red-400"
              : "border-l-border"
          }`}>
            <p className="text-[11px] text-muted">Regularidade</p>
            <p className="text-xl font-bold tabular-nums">
              {sleep.bedtimeVariance !== null ? `±${sleep.bedtimeVariance}min` : "—"}
            </p>
            <p className="text-[11px] text-muted">
              {sleep.bedtimeVariance !== null
                ? sleep.bedtimeVariance <= 30 ? "Excelente — meta: ±30min"
                  : sleep.bedtimeVariance <= 60 ? "Moderada"
                  : "Irregular"
                : "variação do horário"}
            </p>
          </Card>

          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Tendência (7d)</p>
            <p className="text-xl font-bold">
              {sleep.sleepTrend === "up" ? "↑ Aumentando"
                : sleep.sleepTrend === "down" ? "↓ Diminuindo"
                : sleep.sleepTrend === "stable" ? "→ Estável"
                : "—"}
            </p>
            <p className="text-[11px] text-muted">vs semana anterior</p>
          </Card>

          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Qualidade</p>
            <p className="text-xl font-bold tabular-nums">
              {sleep.avgQuality !== null ? `${sleep.avgQuality}%` : "—"}
            </p>
            <p className="text-[11px] text-muted">
              {sleep.avgQuality !== null
                ? sleep.avgQuality >= 80 ? "Boa qualidade"
                  : sleep.avgQuality >= 60 ? "Regular"
                  : "Baixa"
                : "sem dados"}
            </p>
          </Card>
        </div>
      )}

      {/* Clinical tip */}
      {sleep.avgDuration !== null && (sleep.avgDuration < 6 || sleep.avgDuration > 10) && (
        <Card className="mb-4 border-l-4 border-l-amber-500 dark:border-l-amber-400">
          <p className="text-sm font-medium">
            {sleep.avgDuration < 6
              ? "Sono curto persistente pode preceder episódios de mania"
              : "Sono longo persistente pode estar associado a fases depressivas"}
          </p>
          <p className="text-xs text-muted mt-1">
            Padrão merece acompanhamento clínico.
          </p>
        </Card>
      )}

      <p className="mb-4 text-sm text-muted">
        {logsDesc.length} {logsDesc.length === 1 ? "registro" : "registros"} nos últimos 30 dias
      </p>

      {logsDesc.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhum registro de sono nos últimos 30 dias.
          </p>
        </Card>
      ) : (
        <SleepDayGroup logs={logsDesc} readOnly />
      )}
    </div>
  );
}
