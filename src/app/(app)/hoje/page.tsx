import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
import { TodayBlocks } from "@/components/planner/TodayBlocks";
import { ContextualSuggestions } from "@/components/dashboard/ContextualSuggestions";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import { getNews } from "@/lib/news";
import Image from "next/image";
import Link from "next/link";

function formatSleepDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default async function HojePage() {
  const session = await getSession();
  const today = localToday();

  // Fetch today's blocks
  const dayStart = new Date(today + "T00:00:00");
  const dayEnd = new Date(today + "T23:59:59");

  // Run all independent queries in parallel
  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const cutoffStr = localDateStr(last7Days);

  const [blocks, todayEntry, todaySleep, todayRhythm, rules, recentEntries, lastEntry, streakDates] = await Promise.all([
    prisma.plannerBlock.findMany({
      where: {
        userId: session.userId,
        OR: [
          { startAt: { lte: dayEnd }, endAt: { gte: dayStart } },
          { recurrence: { isNot: null }, startAt: { lte: dayEnd } },
        ],
      },
      include: { recurrence: true, exceptions: true },
      orderBy: { startAt: "asc" },
    }),
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
    prisma.stabilityRule.findUnique({
      where: { userId: session.userId },
      select: { targetSleepTimeMin: true },
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
  ]);

  // Streak: count consecutive days with entries ending today
  let streak = 0;
  {
    const dateSet = new Set(streakDates.map((d) => d.date));
    const d = new Date(today + "T12:00:00");
    while (dateSet.has(localDateStr(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }

  // Days since last entry (date-based to avoid time-of-day off-by-one)
  let daysSinceLastEntry: number | null = null;
  if (lastEntry) {
    const todayParts = today.split("-").map(Number);
    const lastParts = lastEntry.date.split("-").map(Number);
    const todayDate = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const lastDate = Date.UTC(lastParts[0], lastParts[1] - 1, lastParts[2]);
    daysSinceLastEntry = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
  }

  // Generate alerts from recent entries
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

  // Latest news (3 items for preview) — external API, may fail
  let newsPreview: Awaited<ReturnType<typeof getNews>> = [];
  try {
    const latestNews = await getNews();
    newsPreview = latestNews.slice(0, 3);
  } catch { /* External API failure — page renders without news */ }

  // Serialize blocks for client component
  const serializedBlocks = blocks.map((b) => ({
    ...b,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    recurrence: b.recurrence ? {
      ...b.recurrence,
      createdAt: b.recurrence.createdAt.toISOString(),
      until: b.recurrence.until?.toISOString() || null,
    } : null,
    exceptions: b.exceptions.map((ex) => ({
      ...ex,
      occurrenceDate: ex.occurrenceDate.toISOString(),
      overrideStartAt: ex.overrideStartAt?.toISOString() || null,
      overrideEndAt: ex.overrideEndAt?.toISOString() || null,
      createdAt: ex.createdAt.toISOString(),
    })),
  }));

  // Anchors from DailyRhythm
  const anchors: { label: string; time: string | null }[] = [];
  if (todayRhythm) {
    if (todayRhythm.wakeTime) anchors.push({ label: "Acordar", time: todayRhythm.wakeTime });
    if (todayRhythm.firstContact) anchors.push({ label: "Primeiro contato", time: todayRhythm.firstContact });
    if (todayRhythm.mainActivityStart) anchors.push({ label: "Atividade principal", time: todayRhythm.mainActivityStart });
    if (todayRhythm.dinnerTime) anchors.push({ label: "Jantar", time: todayRhythm.dinnerTime });
    if (todayRhythm.bedtime) anchors.push({ label: "Dormir", time: todayRhythm.bedtime });
  }

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

      {/* Quick status */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <p className="text-xs text-muted">Humor</p>
          <p className="text-lg font-bold">{todayEntry ? `${todayEntry.mood}/5` : "—"}</p>
          {!todayEntry && (
            <Link href="/checkin" className="text-xs text-primary hover:underline">Fazer agora</Link>
          )}
        </Card>
        <Card>
          <p className="text-xs text-muted">Sono</p>
          <p className="text-lg font-bold">{todaySleep ? formatSleepDuration(todaySleep.totalHours) : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Energia</p>
          <p className="text-lg font-bold">{todayEntry?.energyLevel ? `${todayEntry.energyLevel}/5` : "—"}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Medicação</p>
          <p className="text-lg font-bold">
            {todayEntry?.tookMedication === "sim" ? "Sim" : todayEntry?.tookMedication === "nao" ? "Não" : "—"}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Sequência</p>
          <p className="text-lg font-bold">{streak > 0 ? `${streak}d` : "—"}</p>
        </Card>
      </div>

      {/* Anchors */}
      {anchors.length > 0 && (
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Ancoras do dia</h2>
          <div className="flex flex-wrap gap-3">
            {anchors.map((a) => (
              <div key={a.label} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-indigo-700">{a.time}</span>
                <span className="ml-1.5 text-indigo-600">{a.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Today's blocks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Blocos de hoje</h2>
          <Link href="/planejador" className="text-sm text-primary hover:underline">
            Ver semana
          </Link>
        </div>
        <TodayBlocks
          blocks={serializedBlocks}
          today={today}
          targetSleepTimeMin={rules?.targetSleepTimeMin ?? null}
        />
      </div>

      {/* 7-day trend */}
      {chartData.length >= 2 && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Últimos 7 dias</h2>
            <Link href="/insights" className="text-xs text-primary hover:underline">
              Ver insights
            </Link>
          </div>
          <DashboardChartWrapper data={chartData} />
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/checkin" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Check-in 30s</p>
          </Card>
        </Link>
        <Link href="/planejador" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Planejador</p>
          </Card>
        </Link>
        <Link href="/exercicios" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors text-center">
            <p className="font-medium text-foreground">Respiração</p>
          </Card>
        </Link>
        <Link href="/sos" className="block no-underline">
          <Card className="hover:border-red-300 transition-colors text-center border-red-200">
            <p className="font-medium text-red-600">SOS</p>
          </Card>
        </Link>
      </div>

      {/* Notícias */}
      {newsPreview.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Notícias e Estudos</h2>
            <Link href="/noticias" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {newsPreview.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block no-underline"
              >
                <Card className="hover:border-primary/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      article.source === "pubmed"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {article.source === "pubmed" ? "PubMed" : "Notícia"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-2">{article.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {article.sourceName} · {article.publishedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Integrações */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Integrações</h2>
          <Link href="/integracoes" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href="/integracoes" className="block no-underline">
            <Card className="hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">Google Agenda</p>
                  <p className="text-xs text-muted">Sincronizar planejador</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/financeiro" className="block no-underline">
            <Card className="hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <Image src="/mobills-logo.png" alt="Mobills" width={40} height={40} className="object-contain" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Mobills</p>
                  <p className="text-xs text-muted">Importar financeiro</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/integracoes" className="block no-underline">
            <Card className="hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50">
                  <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.18 0-.36-.02-.53-.06.018-.18.04-.36.04-.55 0-1.12.535-2.22 1.235-3.02C13.666 1.66 14.98 1 16.12 1c.18 0 .36.01.53.02-.01.14-.01.28-.01.41h-.274zm3.44 5.89c-.16.09-2.61 1.53-2.585 4.56.03 3.6 3.14 4.8 3.17 4.81-.02.08-.5 1.7-1.63 3.36-.98 1.45-2 2.9-3.6 2.93-1.57.03-2.08-.94-3.88-.94s-2.39.91-3.87.97c-1.55.06-2.73-1.57-3.72-3.01C1.6 17.18.27 12.84 2.44 9.73c1.07-1.54 2.99-2.52 5.07-2.55 1.52-.03 2.95 1.03 3.88 1.03.93 0 2.67-1.27 4.5-1.08.77.03 2.92.31 4.3 2.33-.11.07-2.56 1.51-2.54 4.49l-.36-.18z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-foreground">Apple Health</p>
                  <p className="text-xs text-muted">Dados de sono</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
