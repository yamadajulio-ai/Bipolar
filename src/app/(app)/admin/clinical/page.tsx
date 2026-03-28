import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { maskIp } from "@/lib/security";
import { localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { AdminMoodChart } from "@/components/admin/AdminMoodChart";

// Small-cohort suppression: n < 10 to prevent re-identification (GPT Pro P0)
const MIN_COHORT = 10;

export default async function AdminClinicalPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (!session.onboarded) redirect("/onboarding");

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_clinical",
      ip: maskIp(ip),
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const totalUsers = await prisma.user.count();

  // ---- MOOD (30d) ----
  const moodEntries = await prisma.diaryEntry.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { mood: true, energyLevel: true, anxietyLevel: true, irritability: true, tookMedication: true, date: true },
  });

  const distinctMoodUsers = new Set(
    (await prisma.diaryEntry.groupBy({ by: ["userId"], where: { createdAt: { gte: thirtyDaysAgo } } })).map((r) => r.userId)
  ).size;

  // Mood distribution
  const moodDist = [0, 0, 0, 0, 0]; // index 0 = mood 1, index 4 = mood 5
  let moodSum = 0, energySum = 0, anxietySum = 0, irritabilitySum = 0;
  let medYes = 0, medTotal = 0;

  for (const e of moodEntries) {
    if (e.mood >= 1 && e.mood <= 5) {
      moodDist[e.mood - 1]++;
      moodSum += e.mood;
    }
    if (e.energyLevel) energySum += e.energyLevel;
    if (e.anxietyLevel) anxietySum += e.anxietyLevel;
    if (e.irritability) irritabilitySum += e.irritability;
    if (e.tookMedication !== null) {
      medTotal++;
      if (e.tookMedication) medYes++;
    }
  }

  const moodAvg = moodEntries.length > 0 ? (moodSum / moodEntries.length).toFixed(1) : "—";
  const energyAvg = moodEntries.length > 0 ? (energySum / moodEntries.length).toFixed(1) : "—";
  const anxietyAvg = moodEntries.length > 0 ? (anxietySum / moodEntries.length).toFixed(1) : "—";
  const irritabilityAvg = moodEntries.length > 0 ? (irritabilitySum / moodEntries.length).toFixed(1) : "—";
  const medAdherence = medTotal > 0 ? Math.round((medYes / medTotal) * 100) : null;

  // Mood by day (for chart)
  const moodByDay: Record<string, { sum: number; count: number }> = {};
  for (const e of moodEntries) {
    const date = e.date;
    if (!moodByDay[date]) moodByDay[date] = { sum: 0, count: 0 };
    moodByDay[date].sum += e.mood;
    moodByDay[date].count++;
  }
  const moodChartData = Object.entries(moodByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      avg: Number((val.sum / val.count).toFixed(2)),
    }));


  // ---- SLEEP (30d) ----
  const sleepLogs = await prisma.sleepLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo }, excluded: false, totalHours: { gte: 2 } },
    select: { totalHours: true, quality: true, awakenings: true, bedtime: true, wakeTime: true },
  });

  const distinctSleepUsers = new Set(
    (await prisma.sleepLog.groupBy({ by: ["userId"], where: { createdAt: { gte: thirtyDaysAgo }, excluded: false, totalHours: { gte: 2 } } })).map((r) => r.userId)
  ).size;

  let sleepHoursSum = 0, qualitySum = 0, qualityCount = 0, awakeningsSum = 0, awakeningsCount = 0;
  const bedtimeHours: number[] = [];
  const wakeHours: number[] = [];

  for (const s of sleepLogs) {
    sleepHoursSum += s.totalHours;
    if (s.quality !== null) { qualitySum += s.quality; qualityCount++; }
    if (s.awakenings !== null) { awakeningsSum += s.awakenings; awakeningsCount++; }
    if (s.bedtime) {
      const [h] = s.bedtime.split(":").map(Number);
      bedtimeHours.push(h);
    }
    if (s.wakeTime) {
      const [h] = s.wakeTime.split(":").map(Number);
      wakeHours.push(h);
    }
  }

  const sleepAvgHours = sleepLogs.length > 0 ? (sleepHoursSum / sleepLogs.length).toFixed(1) : "—";
  const sleepAvgQuality = qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null;
  const sleepAvgAwakenings = awakeningsCount > 0 ? (awakeningsSum / awakeningsCount).toFixed(1) : "—";

  // ---- ASSESSMENTS (90d) ----
  const assessments = await prisma.weeklyAssessment.findMany({
    where: { createdAt: { gte: ninetyDaysAgo } },
    select: { asrmTotal: true, phq9Total: true, fastAvg: true },
  });

  const distinctAssessUsers = new Set(
    (await prisma.weeklyAssessment.groupBy({ by: ["userId"], where: { createdAt: { gte: ninetyDaysAgo } } })).map((r) => r.userId)
  ).size;

  let asrmSum = 0, phq9Sum = 0, fastSum = 0, fastCount = 0;
  const phq9Bands = { minimal: 0, mild: 0, moderate: 0, modSevere: 0, severe: 0 };
  let asrmLow = 0, asrmHigh = 0;

  for (const a of assessments) {
    asrmSum += a.asrmTotal ?? 0;
    phq9Sum += a.phq9Total ?? 0;
    if (a.fastAvg !== null) { fastSum += a.fastAvg; fastCount++; }
    if ((a.asrmTotal ?? 0) < 6) asrmLow++; else asrmHigh++;
    const phq = a.phq9Total ?? 0;
    if (phq < 5) phq9Bands.minimal++;
    else if (phq < 10) phq9Bands.mild++;
    else if (phq < 15) phq9Bands.moderate++;
    else if (phq < 20) phq9Bands.modSevere++;
    else phq9Bands.severe++;
  }

  const asrmAvg = assessments.length > 0 ? (asrmSum / assessments.length).toFixed(1) : "—";
  const phq9Avg = assessments.length > 0 ? (phq9Sum / assessments.length).toFixed(1) : "—";
  const fastAvg = fastCount > 0 ? (fastSum / fastCount).toFixed(1) : "—";

  // ---- HEALTH METRICS (wearables) ----
  const healthMetrics = await prisma.healthMetric.findMany({
    where: { date: { gte: localDateStr(thirtyDaysAgo) } },
    select: { metric: true, value: true },
  });

  let stepsSum = 0, stepsCount = 0;
  let hrvSum = 0, hrvCount = 0;
  let hrSum = 0, hrCount = 0;

  for (const m of healthMetrics) {
    if (m.metric === "steps") { stepsSum += m.value; stepsCount++; }
    // HRV and resting HR from sleep logs or health metrics
  }

  // Get HRV and HR from sleep logs
  const sleepWithHealth = await prisma.sleepLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo }, excluded: false },
    select: { hrv: true, heartRate: true },
  });

  for (const s of sleepWithHealth) {
    if (s.hrv !== null) { hrvSum += s.hrv; hrvCount++; }
    if (s.heartRate !== null) { hrSum += s.heartRate; hrCount++; }
  }

  const suppressMood = distinctMoodUsers < MIN_COHORT;
  const suppressSleep = distinctSleepUsers < MIN_COHORT;
  const suppressAssess = distinctAssessUsers < MIN_COHORT;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dados Clínicos Agregados</h1>
      <Alert variant="info">
        Todos os dados nesta página são agregados. Nenhum dado individual identificável é exibido.
        Dados suprimidos quando o cohort é menor que {MIN_COHORT} usuários para evitar re-identificação.
      </Alert>

      {/* Mood */}
      <h2 className="text-lg font-semibold">Humor (últimos 30 dias)</h2>
      {suppressMood ? (
        <Card><p className="text-sm text-muted">Cohort insuficiente ({distinctMoodUsers} usuários). Mínimo: {MIN_COHORT}.</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <p className="text-xs text-muted">Humor médio</p>
              <p className="text-2xl font-bold">{moodAvg}<span className="text-sm font-normal">/5</span></p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Energia média</p>
              <p className="text-2xl font-bold">{energyAvg}<span className="text-sm font-normal">/5</span></p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Ansiedade média</p>
              <p className="text-2xl font-bold">{anxietyAvg}<span className="text-sm font-normal">/5</span></p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Irritabilidade média</p>
              <p className="text-2xl font-bold">{irritabilityAvg}<span className="text-sm font-normal">/5</span></p>
            </Card>
          </div>

          {/* Mood distribution */}
          <Card>
            <h3 className="text-sm font-semibold mb-3">Distribuição de humor</h3>
            <div className="space-y-2">
              {moodDist.map((count, i) => {
                const pct = moodEntries.length > 0 ? Math.round((count / moodEntries.length) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-6 text-right font-medium">{i + 1}</span>
                    <div className="flex-1 h-3 rounded-full bg-surface-alt overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-16">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Mood chart */}
          {moodChartData.length > 1 && (
            <Card>
              <h3 className="text-sm font-semibold mb-2">Humor médio por dia</h3>
              <AdminMoodChart data={moodChartData} />
            </Card>
          )}
        </>
      )}

      {/* Medication adherence */}
      {medAdherence !== null && !suppressMood && (
        <Card>
          <p className="text-xs text-muted">Adesão à medicação (agregada)</p>
          <p className="text-2xl font-bold">{medAdherence}%</p>
          <p className="text-xs text-muted mt-1">{medYes} sim / {medTotal} registros</p>
        </Card>
      )}

      {/* Sleep */}
      <h2 className="text-lg font-semibold">Sono (últimos 30 dias)</h2>
      {suppressSleep ? (
        <Card><p className="text-sm text-muted">Cohort insuficiente ({distinctSleepUsers} usuários). Mínimo: {MIN_COHORT}.</p></Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-xs text-muted">Média de horas</p>
            <p className="text-2xl font-bold">{sleepAvgHours}h</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Qualidade média</p>
            <p className="text-2xl font-bold">{sleepAvgQuality !== null ? `${sleepAvgQuality}%` : "—"}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Despertares médios</p>
            <p className="text-2xl font-bold">{sleepAvgAwakenings}</p>
          </Card>
        </div>
      )}

      {/* Assessments */}
      <h2 className="text-lg font-semibold">Avaliações (últimos 90 dias)</h2>
      {suppressAssess ? (
        <Card><p className="text-sm text-muted">Cohort insuficiente ({distinctAssessUsers} usuários). Mínimo: {MIN_COHORT}.</p></Card>
      ) : assessments.length === 0 ? (
        <Card><p className="text-sm text-muted">Nenhuma avaliação no período.</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-muted">ASRM médio (mania)</p>
              <p className="text-2xl font-bold">{asrmAvg}<span className="text-sm font-normal">/20</span></p>
              <p className="text-xs text-muted mt-1">&lt;6: {asrmLow} · ≥6: {asrmHigh}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">PHQ-9 médio (depressão)</p>
              <p className="text-2xl font-bold">{phq9Avg}<span className="text-sm font-normal">/27</span></p>
            </Card>
            <Card>
              <p className="text-xs text-muted">FAST médio (funcionamento)</p>
              <p className="text-2xl font-bold">{fastAvg}</p>
            </Card>
          </div>

          {/* PHQ-9 distribution */}
          <Card>
            <h3 className="text-sm font-semibold mb-2">Distribuição PHQ-9</h3>
            <div className="space-y-1 text-sm">
              {[
                { label: "Mínimo (0-4)", count: phq9Bands.minimal, color: "bg-green-400" },
                { label: "Leve (5-9)", count: phq9Bands.mild, color: "bg-yellow-400" },
                { label: "Moderado (10-14)", count: phq9Bands.moderate, color: "bg-amber-400" },
                { label: "Mod. Severo (15-19)", count: phq9Bands.modSevere, color: "bg-orange-400" },
                { label: "Severo (20+)", count: phq9Bands.severe, color: "bg-red-400" },
              ].map((band) => {
                const pct = assessments.length > 0 ? Math.round((band.count / assessments.length) * 100) : 0;
                return (
                  <div key={band.label} className="flex items-center gap-3">
                    <span className="w-36 text-xs">{band.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-alt overflow-hidden">
                      <div className={`h-full rounded-full ${band.color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted w-16">{band.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Health metrics */}
      {(stepsCount > 0 || hrvCount > 0 || hrCount > 0) && (
        <>
          <h2 className="text-lg font-semibold">Dados de saúde (wearables)</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stepsCount > 0 && (
              <Card>
                <p className="text-xs text-muted">Passos/dia</p>
                <p className="text-2xl font-bold">{Math.round(stepsSum / stepsCount).toLocaleString("pt-BR")}</p>
              </Card>
            )}
            {hrvCount > 0 && (
              <Card>
                <p className="text-xs text-muted">HRV médio</p>
                <p className="text-2xl font-bold">{Math.round(hrvSum / hrvCount)} ms</p>
              </Card>
            )}
            {hrCount > 0 && (
              <Card>
                <p className="text-xs text-muted">FC repouso média</p>
                <p className="text-2xl font-bold">{Math.round(hrSum / hrCount)} bpm</p>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
