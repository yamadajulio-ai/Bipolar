import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { localDateStr } from "@/lib/dateUtils";
import { SleepDayGroup } from "@/components/insights/SleepHistoryCard";
import { Sparkline } from "@/components/insights/Sparkline";

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default async function SonoPage() {
  const session = await getSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "asc" },
  });

  // ── Compute summary stats for real sleep (>= 2h, not excluded) ──
  const realLogs = logs.filter((l) => l.totalHours >= 2 && !l.excluded);

  // Aggregate multiple cycles per day into daily totals
  function aggregateByDay(logsArr: typeof realLogs): { date: string; totalHours: number; bedtime: string }[] {
    const byDate = new Map<string, { totalHours: number; bedtime: string }>();
    for (const l of logsArr) {
      const existing = byDate.get(l.date);
      if (existing) {
        existing.totalHours += l.totalHours;
        // Keep earliest bedtime for regularity calc
        if (l.bedtime < existing.bedtime) existing.bedtime = l.bedtime;
      } else {
        byDate.set(l.date, { totalHours: l.totalHours, bedtime: l.bedtime });
      }
    }
    return Array.from(byDate.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  const dailyTotals = aggregateByDay(realLogs);
  const avgDuration = dailyTotals.length > 0
    ? dailyTotals.reduce((sum, d) => sum + d.totalHours, 0) / dailyTotals.length
    : null;

  // Personal baseline: median of daily totals (14+ days needed), otherwise 8h clinical default
  const personalBaseline = dailyTotals.length >= 14
    ? (() => {
        const sorted = dailyTotals.map((d) => d.totalHours).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      })()
    : 8;
  const deviationMin = avgDuration !== null ? Math.round((avgDuration - personalBaseline) * 60) : null;

  // Bedtime regularity (std dev of earliest bedtime per day)
  function timeToMinutes(t: string): number | null {
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    let mins = h * 60 + m;
    if (mins < 720) mins += 1440; // normalize: before noon = next day
    return mins;
  }

  const bedtimeMinutes = dailyTotals
    .map((d) => timeToMinutes(d.bedtime))
    .filter((v): v is number => v !== null);

  let bedtimeVariance: number | null = null;
  if (bedtimeMinutes.length >= 3) {
    const mean = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
    const variance = bedtimeMinutes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / bedtimeMinutes.length;
    bedtimeVariance = Math.round(Math.sqrt(variance));
  }

  // Last 7 days trend (by daily totals)
  const last7 = dailyTotals.slice(-7);
  const prev7 = dailyTotals.slice(-14, -7);
  let trend: "up" | "down" | "stable" | null = null;
  if (last7.length >= 3 && prev7.length >= 3) {
    const avgLast = last7.reduce((s, d) => s + d.totalHours, 0) / last7.length;
    const avgPrev = prev7.reduce((s, d) => s + d.totalHours, 0) / prev7.length;
    const diff = avgLast - avgPrev;
    trend = diff > 0.5 ? "up" : diff < -0.5 ? "down" : "stable";
  }

  // Sparkline data (last 14 days, daily totals)
  const sparklineData = dailyTotals.slice(-14).map((d) => d.totalHours);

  // Average quality
  const qualityLogs = realLogs.filter((l) => l.quality > 0);
  const avgQuality = qualityLogs.length > 0
    ? Math.round(qualityLogs.reduce((s, l) => s + (l.quality <= 5 ? l.quality * 20 : l.quality), 0) / qualityLogs.length)
    : null;

  // Display in reverse chronological order
  const logsDesc = [...logs].reverse();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sono</h1>
        <Link
          href="/sono/novo"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
        >
          Novo registro
        </Link>
      </div>

      {/* ── Summary Cards ─────────────────────────────────── */}
      {realLogs.length >= 3 && (
        <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3">
          {/* Média + sparkline */}
          <Card className={`border-l-4 ${
            avgDuration !== null
              ? avgDuration >= 7 && avgDuration <= 9 ? "border-l-green-500 dark:border-l-green-400"
                : avgDuration >= 5 ? "border-l-amber-500 dark:border-l-amber-400"
                : "border-l-red-500 dark:border-l-red-400"
              : "border-l-border"
          }`}>
            <p className="text-[11px] text-muted">Média</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold tabular-nums">
                {avgDuration !== null ? formatSleepDuration(avgDuration) : "—"}
              </p>
              {sparklineData.length >= 5 && (
                <Sparkline
                  data={sparklineData}
                  color={avgDuration !== null && avgDuration >= 7 && avgDuration <= 9 ? "#22c55e" : "#f59e0b"}
                  baseline={personalBaseline}
                  min={4}
                  max={12}
                />
              )}
            </div>
            {deviationMin !== null && (
              <p className="text-[10px] text-muted">
                {deviationMin === 0 ? `Na sua média (${formatSleepDuration(personalBaseline)})`
                  : deviationMin > 0 ? `+${deviationMin}min vs sua média`
                  : `${deviationMin}min vs sua média`}
              </p>
            )}
          </Card>

          {/* Regularidade */}
          <Card className={`border-l-4 ${
            bedtimeVariance !== null
              ? bedtimeVariance <= 30 ? "border-l-green-500 dark:border-l-green-400"
                : bedtimeVariance <= 60 ? "border-l-amber-500 dark:border-l-amber-400"
                : "border-l-red-500 dark:border-l-red-400"
              : "border-l-border"
          }`}>
            <p className="text-[11px] text-muted">Regularidade</p>
            <p className="text-xl font-bold tabular-nums">
              {bedtimeVariance !== null ? `±${bedtimeVariance}min` : "—"}
            </p>
            <p className="text-[10px] text-muted">
              {bedtimeVariance !== null
                ? bedtimeVariance <= 30 ? "Excelente — meta: ±30min"
                  : bedtimeVariance <= 60 ? "Moderada — tente horários fixos"
                  : "Irregular — priorize horário de dormir"
                : "variação do horário"}
            </p>
          </Card>

          {/* Tendência */}
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Tendência (7d)</p>
            <p className="text-xl font-bold">
              {trend === "up" ? "↑ Aumentando"
                : trend === "down" ? "↓ Diminuindo"
                : trend === "stable" ? "→ Estável"
                : "—"}
            </p>
            <p className="text-[10px] text-muted">vs semana anterior</p>
          </Card>

          {/* Qualidade */}
          <Card className="border-l-4 border-l-border">
            <p className="text-[11px] text-muted">Qualidade</p>
            <p className="text-xl font-bold tabular-nums">
              {avgQuality !== null ? `${avgQuality}%` : "—"}
            </p>
            <p className="text-[10px] text-muted">
              {avgQuality !== null
                ? avgQuality >= 80 ? "Boa qualidade"
                  : avgQuality >= 60 ? "Regular"
                  : "Baixa — vale investigar"
                : "sem dados"}
            </p>
          </Card>
        </div>
      )}

      {/* Clinical tip based on data */}
      {avgDuration !== null && (avgDuration < 6 || avgDuration > 10) && (
        <Card className="mb-4 border-l-4 border-l-amber-500 dark:border-l-amber-400">
          <p className="text-sm font-medium">
            {avgDuration < 6
              ? "Sono curto persistente pode preceder episódios de mania"
              : "Sono longo persistente pode estar associado a fases depressivas"}
          </p>
          <p className="text-xs text-muted mt-1">
            Se esse padrão continuar, vale conversar com seu profissional de saúde.
          </p>
        </Card>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {logsDesc.length} {logsDesc.length === 1 ? "registro" : "registros"} nos últimos 30 dias
        </p>
        <Link
          href="/sono/tendencias"
          className="text-sm text-primary hover:underline"
        >
          Ver tendências &rarr;
        </Link>
      </div>

      {logsDesc.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Registre seu sono para acompanhar tendências e receber insights personalizados.{" "}
            <Link href="/sono/novo" className="text-primary hover:underline">
              Registrar primeira noite
            </Link>
          </p>
        </Card>
      ) : (
        <SleepDayGroup logs={logsDesc} />
      )}
    </div>
  );
}
