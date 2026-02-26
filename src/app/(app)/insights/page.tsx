import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { InsightsCharts } from "@/components/planner/InsightsCharts";
import { localDateStr } from "@/lib/dateUtils";
import { expandPrismaBlocks } from "@/lib/planner/expandServer";

export default async function InsightsPage() {
  const session = await getSession();
  const now = new Date();
  const cutoff30 = new Date(now);
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff30Str = localDateStr(cutoff30);

  // Fetch last 30 days of sleep logs
  const sleepLogs = await prisma.sleepLog.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str } },
    orderBy: { date: "asc" },
  });

  // Fetch last 30 days of daily rhythms
  const rhythms = await prisma.dailyRhythm.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str } },
    orderBy: { date: "asc" },
  });

  // Fetch last 30 days of diary entries
  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.userId, date: { gte: cutoff30Str } },
    orderBy: { date: "asc" },
  });

  // Fetch planner blocks for last 7 days (using overlap + recurring expansion)
  const rawBlocks = await prisma.plannerBlock.findMany({
    where: {
      userId: session.userId,
      OR: [
        { startAt: { lte: now }, endAt: { gte: cutoff7 } },
        { recurrence: { isNot: null }, startAt: { lte: now } },
      ],
    },
    include: { recurrence: true, exceptions: true },
    orderBy: { startAt: "asc" },
  });
  const expandedBlocks = expandPrismaBlocks(rawBlocks, cutoff7, now);

  // Fetch stability rules
  const rules = await prisma.stabilityRule.findUnique({
    where: { userId: session.userId },
  });

  // ── Compute insights ─────────────────────────────────────────────

  // 1. Sleep regularity
  const sleepBedtimes = sleepLogs.map((s) => {
    const [h, m] = s.bedtime.split(":").map(Number);
    return h * 60 + m;
  });
  const sleepWakeTimes = sleepLogs.map((s) => {
    const [h, m] = s.wakeTime.split(":").map(Number);
    return h * 60 + m;
  });
  const bedtimeVariance = computeStdDev(sleepBedtimes);
  const wakeVariance = computeStdDev(sleepWakeTimes);
  const avgSleepHours = sleepLogs.length > 0
    ? Math.round((sleepLogs.reduce((s, l) => s + l.totalHours, 0) / sleepLogs.length) * 10) / 10
    : null;

  // 2. Anchor regularity (IPSRT)
  const anchorFields = ["wakeTime", "firstContact", "mainActivityStart", "dinnerTime", "bedtime"] as const;
  const anchorVariances: Record<string, number | null> = {};
  for (const field of anchorFields) {
    const values = rhythms
      .map((r) => r[field])
      .filter((v): v is string => v !== null)
      .map((v) => {
        const [h, m] = v.split(":").map(Number);
        return h * 60 + m;
      });
    anchorVariances[field] = values.length >= 3 ? computeStdDev(values) : null;
  }

  // 3. Weekly energy load from planner (using expanded occurrences)
  const weeklyEnergy = expandedBlocks.reduce((sum, b) => sum + b.energyCost, 0);

  // 4. Late nights — consistent with constraints.ts (includes post-midnight)
  const lateEventCutoffMin = rules?.lateEventCutoffMin ?? 1260;
  const lateNights = expandedBlocks.filter((b) => {
    const endMin = b.endAt.getHours() * 60 + b.endAt.getMinutes();
    const isLate = endMin > lateEventCutoffMin || (endMin < 360 && endMin > 0);
    return isLate && b.kind !== "ANCHOR";
  }).length;

  // 5. Mood-sleep data for chart
  const chartData = entries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: e.sleepHours,
    energy: e.energyLevel,
  }));

  // Generate observations (not alerts — softer language)
  const observations: string[] = [];
  if (bedtimeVariance !== null && bedtimeVariance > 90) {
    observations.push("Variacao no horario de dormir esta acima de 90 minutos. Regularidade do sono e importante para estabilidade.");
  }
  if (wakeVariance !== null && wakeVariance > 90) {
    observations.push("Variacao no horario de acordar esta acima de 90 minutos.");
  }
  if (avgSleepHours !== null && avgSleepHours < 6) {
    observations.push(`Media de sono: ${avgSleepHours}h. Poucas horas de sono podem afetar o humor.`);
  }
  if (lateNights > 3) {
    observations.push(`${lateNights} blocos com atividade tardia nos ultimos 7 dias. Atividades noturnas podem afetar seu ritmo.`);
  }
  if (weeklyEnergy > 60) {
    observations.push(`Carga de energia semanal alta (${weeklyEnergy}). Considere equilibrar com periodos de descanso.`);
  }

  const anchorLabels: Record<string, string> = {
    wakeTime: "Acordar",
    firstContact: "Primeiro contato",
    mainActivityStart: "Atividade principal",
    dinnerTime: "Jantar",
    bedtime: "Dormir",
  };

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Insights</h1>
      <p className="mb-6 text-sm text-muted">
        Tendencias e observacoes sobre sua estabilidade. Nao substitui avaliacao profissional.
      </p>

      {/* Observations */}
      {observations.length > 0 && (
        <div className="mb-6 space-y-2">
          {observations.map((obs, i) => (
            <Alert key={i} variant="info">
              {obs}
            </Alert>
          ))}
        </div>
      )}

      {/* Key metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Media de sono</p>
          <p className="text-2xl font-bold">{avgSleepHours !== null ? `${avgSleepHours}h` : "—"}</p>
          <p className="text-xs text-muted">{sleepLogs.length} registros</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Variacao sono</p>
          <p className="text-2xl font-bold">{bedtimeVariance !== null ? `${bedtimeVariance}min` : "—"}</p>
          <p className="text-xs text-muted">horario de dormir</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Carga semanal</p>
          <p className="text-2xl font-bold">{weeklyEnergy}</p>
          <p className="text-xs text-muted">energia total</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Noites tardias</p>
          <p className="text-2xl font-bold">{lateNights}</p>
          <p className="text-xs text-muted">ultimos 7 dias</p>
        </Card>
      </div>

      {/* Anchor regularity */}
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Regularidade de Ancoras (IPSRT)</h2>
        <p className="mb-3 text-xs text-muted">
          Variacao em minutos — menor = mais regular. Baseado nos ultimos 30 dias.
        </p>
        <div className="space-y-2">
          {anchorFields.map((field) => {
            const variance = anchorVariances[field];
            return (
              <div key={field} className="flex items-center gap-3">
                <span className="w-36 text-sm text-foreground">{anchorLabels[field]}</span>
                {variance !== null ? (
                  <>
                    <div className="flex-1 h-2 rounded-full bg-gray-200">
                      <div
                        className={`h-2 rounded-full ${
                          variance <= 30 ? "bg-green-400" : variance <= 60 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${Math.min(100, (variance / 120) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-16 text-right">{variance} min</span>
                  </>
                ) : (
                  <span className="text-xs text-muted">Dados insuficientes</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Mood/Sleep chart */}
      {chartData.length >= 3 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Humor e Sono</h2>
          <InsightsCharts data={chartData} />
        </Card>
      )}

      <p className="text-center text-xs text-muted mt-4">
        Estas observacoes sao baseadas em padroes dos seus registros. Nao substituem avaliacao profissional.
      </p>
    </div>
  );
}

function computeStdDev(values: number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.round(Math.sqrt(variance));
}
