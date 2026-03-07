import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { getNews } from "@/lib/news";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
import { ContextualSuggestions } from "@/components/dashboard/ContextualSuggestions";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import Link from "next/link";
import Image from "next/image";

function formatSleepDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const moodLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito deprimido", color: "text-red-600" },
  2: { text: "Deprimido", color: "text-orange-600" },
  3: { text: "Eutímico (estável)", color: "text-emerald-700" },
  4: { text: "Elevado", color: "text-amber-600" },
  5: { text: "Muito elevado", color: "text-red-600" },
};

const energyLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito baixa", color: "text-red-600" },
  2: { text: "Baixa", color: "text-orange-600" },
  3: { text: "Normal", color: "text-emerald-700" },
  4: { text: "Alta", color: "text-amber-600" },
  5: { text: "Muito alta", color: "text-red-600" },
};

export default async function HojePage() {
  const session = await getSession();
  const today = localToday();

  const dayStart = new Date(today + "T00:00:00");
  const dayEnd = new Date(today + "T23:59:59");

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const cutoffStr = localDateStr(last7Days);

  const [todayEntry, todaySleep, todayRhythm, recentEntries, lastEntry, streakDates, upcomingBlocks] = await Promise.all([
    prisma.diaryEntry.findFirst({
      where: { userId: session.userId, date: today },
      select: { mood: true, sleepHours: true, energyLevel: true, tookMedication: true },
    }),
    prisma.sleepLog.findFirst({
      where: { userId: session.userId, date: today },
      select: { totalHours: true },
    }),
    prisma.dailyRhythm.findFirst({
      where: { userId: session.userId, date: today },
      select: { wakeTime: true, firstContact: true, mainActivityStart: true, dinnerTime: true, bedtime: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId, date: { gte: cutoffStr } },
      select: { date: true, mood: true, sleepHours: true },
      orderBy: { date: "asc" },
    }),
    prisma.diaryEntry.findFirst({
      where: { userId: session.userId },
      orderBy: { date: "desc" },
      select: { date: true },
    }),
    prisma.diaryEntry.findMany({
      where: { userId: session.userId },
      orderBy: { date: "desc" },
      select: { date: true },
      take: 90,
    }),
    prisma.plannerBlock.findMany({
      where: {
        userId: session.userId,
        startAt: { gte: new Date(), lte: dayEnd },
      },
      select: { title: true, startAt: true, endAt: true },
      orderBy: { startAt: "asc" },
      take: 3,
    }),
  ]);

  // Streak
  let streak = 0;
  {
    const dateSet = new Set(streakDates.map((d) => d.date));
    const d = new Date(today + "T12:00:00");
    while (dateSet.has(localDateStr(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }

  // Days since last entry
  let daysSinceLastEntry: number | null = null;
  if (lastEntry) {
    const todayParts = today.split("-").map(Number);
    const lastParts = lastEntry.date.split("-").map(Number);
    const todayDate = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const lastDate = Date.UTC(lastParts[0], lastParts[1] - 1, lastParts[2]);
    daysSinceLastEntry = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
  }

  // Alerts
  const recentAlerts: string[] = [];
  if (recentEntries.length >= 3) {
    const last3 = recentEntries.slice(-3);
    if (last3[0].sleepHours > last3[1].sleepHours && last3[1].sleepHours > last3[2].sleepHours) {
      recentAlerts.push("Seu sono está diminuindo progressivamente. Alterações no sono podem preceder episódios. Este alerta é automático e não substitui avaliação profissional.");
    }
    if (last3.every((e) => e.mood >= 4)) {
      recentAlerts.push("Sinais de humor elevado persistente nos últimos dias. Converse com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }
    if (last3.every((e) => e.mood <= 2)) {
      recentAlerts.push("Sinais de humor baixo persistente nos últimos dias. Considere conversar com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }
  }

  const chartData = recentEntries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: e.sleepHours,
  }));

  // News (top 3) + Health metrics
  let newsArticles: { title: string; url: string; sourceName: string | null; publishedAt: Date }[] = [];
  try {
    const allNews = await getNews();
    newsArticles = allNews.slice(0, 3);
  } catch { /* news fetch failed silently */ }

  // Latest health metrics from Apple Watch (last 7 days)
  const healthCutoff = new Date();
  healthCutoff.setDate(healthCutoff.getDate() - 7);
  const healthCutoffStr = localDateStr(healthCutoff);
  const [latestMetrics, recentSleepLogs, googleCal, haeKey, financialTx] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { userId: session.userId, date: { gte: healthCutoffStr } },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.sleepLog.findMany({
      where: { userId: session.userId, date: { gte: healthCutoffStr }, totalHours: { gte: 1 } },
      orderBy: { date: "desc" },
      take: 7,
      select: { date: true, totalHours: true, hrv: true, heartRate: true, quality: true },
    }),
    prisma.googleAccount.findFirst({ where: { userId: session.userId }, select: { id: true } }),
    prisma.integrationKey.findFirst({ where: { userId: session.userId, service: "health_auto_export", enabled: true }, select: { id: true } }),
    prisma.financialTransaction.findFirst({ where: { userId: session.userId }, select: { id: true } }),
  ]);

  const hasGoogleCal = !!googleCal;
  const hasHae = !!haeKey;
  const hasFinancial = !!financialTx;
  const hasMissingIntegrations = !hasGoogleCal || !hasHae || !hasFinancial;

  // Aggregate health metrics for display
  const avgSteps = (() => {
    const steps = latestMetrics.filter((m) => m.metric === "steps");
    if (steps.length === 0) return null;
    return Math.round(steps.reduce((s, m) => s + m.value, 0) / steps.length);
  })();
  const avgHrv = (() => {
    const hrvLogs = recentSleepLogs.filter((s) => s.hrv !== null);
    if (hrvLogs.length === 0) return null;
    return Math.round(hrvLogs.reduce((s, l) => s + (l.hrv || 0), 0) / hrvLogs.length);
  })();
  const avgHr = (() => {
    const hrLogs = recentSleepLogs.filter((s) => s.heartRate !== null);
    if (hrLogs.length === 0) return null;
    return Math.round(hrLogs.reduce((s, l) => s + (l.heartRate || 0), 0) / hrLogs.length);
  })();
  const hasHealthData = avgSteps !== null || avgHrv !== null || avgHr !== null;

  // Anchors
  const anchors: { label: string; time: string }[] = [];
  if (todayRhythm) {
    if (todayRhythm.wakeTime) anchors.push({ label: "Acordar", time: todayRhythm.wakeTime });
    if (todayRhythm.firstContact) anchors.push({ label: "1o contato social", time: todayRhythm.firstContact });
    if (todayRhythm.mainActivityStart) anchors.push({ label: "Atividade principal", time: todayRhythm.mainActivityStart });
    if (todayRhythm.dinnerTime) anchors.push({ label: "Jantar", time: todayRhythm.dinnerTime });
    if (todayRhythm.bedtime) anchors.push({ label: "Dormir", time: todayRhythm.bedtime });
  }

  const formatBlockTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="space-y-6">
      <Greeting />

      {/* Contextual alerts */}
      <ContextualSuggestions
        hasTodayEntry={!!todayEntry}
        hasTodaySleep={!!todaySleep}
        daysSinceLastEntry={daysSinceLastEntry}
        recentAlerts={recentAlerts}
      />

      {/* === AÇÕES PRINCIPAIS === */}
      <div className="grid grid-cols-2 gap-3">
        {!todayEntry ? (
          <Link href="/checkin" className="block no-underline">
            <Card className="border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-center py-5">
              <div className="text-2xl mb-1">&#9997;&#65039;</div>
              <p className="font-semibold text-foreground">Check-in diário</p>
              <p className="text-xs text-muted mt-1">Registrar humor, energia e medicação</p>
            </Card>
          </Link>
        ) : (
          <Card className="border-emerald-200 bg-emerald-50/50 text-center py-5">
            <div className="text-2xl mb-1">&#9989;</div>
            <p className="font-semibold text-emerald-700">Check-in feito</p>
            <p className="text-xs text-emerald-600 mt-1">Humor, energia e medicação registrados</p>
          </Card>
        )}

        {!todaySleep ? (
          <Link href="/sono/novo" className="block no-underline">
            <Card className="border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-center py-5">
              <div className="text-2xl mb-1">&#127769;</div>
              <p className="font-semibold text-foreground">Registrar sono</p>
              <p className="text-xs text-muted mt-1">Como foi a noite passada?</p>
            </Card>
          </Link>
        ) : (
          <Card className="border-emerald-200 bg-emerald-50/50 text-center py-5">
            <div className="text-2xl mb-1">&#9989;</div>
            <p className="font-semibold text-emerald-700">Sono registrado</p>
            <p className="text-xs text-emerald-600 mt-1">{formatSleepDuration(todaySleep.totalHours)} dormidas</p>
          </Card>
        )}
      </div>

      {/* === INTEGRAÇÕES PENDENTES (topo se faltam) === */}
      {hasMissingIntegrations && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Configure suas integrações</h2>
          <p className="mb-3 text-xs text-muted">Conecte para ter dados automáticos e insights mais completos.</p>
          <div className="grid grid-cols-3 gap-2">
            {!hasHae && (
              <Link href="/integracoes" className="flex flex-col items-center gap-1.5 rounded-lg bg-red-50 p-3 no-underline hover:bg-red-100 transition-colors">
                <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.18 0-.36-.02-.53-.06.018-.18.04-.36.04-.55 0-1.12.535-2.22 1.235-3.02C13.666 1.66 14.98 1 16.12 1c.18 0 .36.01.53.02-.01.14-.01.28-.01.41h-.274zm3.44 5.89c-.16.09-2.61 1.53-2.585 4.56.03 3.6 3.14 4.8 3.17 4.81-.02.08-.5 1.7-1.63 3.36-.98 1.45-2 2.9-3.6 2.93-1.57.03-2.08-.94-3.88-.94s-2.39.91-3.87.97c-1.55.06-2.73-1.57-3.72-3.01C1.6 17.18.27 12.84 2.44 9.73c1.07-1.54 2.99-2.52 5.07-2.55 1.52-.03 2.95 1.03 3.88 1.03.93 0 2.67-1.27 4.5-1.08.77.03 2.92.31 4.3 2.33-.11.07-2.56 1.51-2.54 4.49l-.36-.18z" />
                </svg>
                <span className="text-xs font-medium text-red-700">Apple Watch</span>
              </Link>
            )}
            {!hasGoogleCal && (
              <Link href="/planejador" className="flex flex-col items-center gap-1.5 rounded-lg bg-blue-50 p-3 no-underline hover:bg-blue-100 transition-colors">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="text-xs font-medium text-blue-700">Google Agenda</span>
              </Link>
            )}
            {!hasFinancial && (
              <Link href="/financeiro" className="flex flex-col items-center gap-1.5 rounded-lg bg-green-50 p-3 no-underline hover:bg-green-100 transition-colors">
                <Image src="/mobills-logo.png" alt="Mobills" width={24} height={24} className="object-contain" />
                <span className="text-xs font-medium text-green-700">Mobills</span>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* === RESUMO DO DIA === */}
      {todayEntry && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Resumo de hoje</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Humor (check-in)</span>
              <span className={`text-sm font-medium ${moodLabels[todayEntry.mood]?.color || "text-foreground"}`}>
                {todayEntry.mood}/5 — {moodLabels[todayEntry.mood]?.text || ""}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Sono (noite passada)</span>
              <span className="text-sm font-medium text-foreground">
                {todaySleep ? formatSleepDuration(todaySleep.totalHours) : "Não registrado"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Energia (check-in)</span>
              <span className={`text-sm font-medium ${todayEntry.energyLevel ? (energyLabels[todayEntry.energyLevel]?.color || "text-foreground") : "text-muted"}`}>
                {todayEntry.energyLevel ? `${todayEntry.energyLevel}/5 — ${energyLabels[todayEntry.energyLevel]?.text || ""}` : "Não informado"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Medicação</span>
              <span className={`text-sm font-medium ${todayEntry.tookMedication === "sim" ? "text-emerald-700" : todayEntry.tookMedication === "nao" ? "text-red-600" : "text-amber-600"}`}>
                {todayEntry.tookMedication === "sim" ? "Já tomou" : todayEntry.tookMedication === "nao" ? "Não tomou" : todayEntry.tookMedication === "nao_sei" ? "Ainda não" : "Não informado"}
              </span>
            </div>
            {streak > 0 && (
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-muted">Dias seguidos com check-in</span>
                <span className="text-sm font-medium text-primary">{streak} {streak === 1 ? "dia" : "dias"}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* === ÂNCORAS DO DIA === */}
      {anchors.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Rotina de hoje</h2>
            <Link href="/rotina" className="text-xs text-primary hover:underline">Editar</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {anchors.map((a) => (
              <div key={a.label} className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm">
                <span className="font-medium text-primary-dark">{a.time}</span>
                <span className="ml-1.5 text-primary">{a.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* === PRÓXIMAS ATIVIDADES === */}
      {upcomingBlocks.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Próximas atividades</h2>
            <Link href="/planejador" className="text-xs text-primary hover:underline">Ver semana</Link>
          </div>
          <div className="space-y-2">
            {upcomingBlocks.map((b, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-alt px-3 py-2">
                <span className="text-xs font-medium text-muted whitespace-nowrap">
                  {formatBlockTime(b.startAt)}
                </span>
                <span className="text-sm text-foreground">{b.title}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* === DADOS DO CORPO (Apple Watch) === */}
      {hasHealthData && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Dados do corpo (7 dias)</h2>
            <Link href="/integracoes" className="text-xs text-primary hover:underline">Configurar</Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {avgSteps !== null && (
              <div className="rounded-lg bg-blue-50 p-3">
                <p className="text-lg font-semibold text-blue-700">{avgSteps.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-blue-600">Passos/dia</p>
              </div>
            )}
            {avgHrv !== null && (
              <div className="rounded-lg bg-purple-50 p-3">
                <p className="text-lg font-semibold text-purple-700">{avgHrv} ms</p>
                <p className="text-xs text-purple-600">HRV (sono)</p>
              </div>
            )}
            {avgHr !== null && (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-lg font-semibold text-red-700">{avgHr} bpm</p>
                <p className="text-xs text-red-600">FC repouso</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Via Apple Health (Health Auto Export)</p>
        </Card>
      )}

      {/* === NOTÍCIAS === */}
      {newsArticles.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Notícias e estudos</h2>
            <Link href="/noticias" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {newsArticles.map((article) => (
              <a
                key={article.url}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg bg-surface-alt p-3 no-underline hover:bg-primary/5 transition-colors"
              >
                <p className="text-sm font-medium text-foreground line-clamp-2">{article.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {article.sourceName || "PubMed"} &middot;{" "}
                  {article.publishedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </p>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* === GRÁFICO 7 DIAS (último bloco) === */}
      {chartData.length >= 2 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Últimos 7 dias</h2>
            <Link href="/insights" className="text-xs text-primary hover:underline">
              Ver insights completos
            </Link>
          </div>
          <DashboardChartWrapper data={chartData} />
        </Card>
      )}
    </div>
  );
}
