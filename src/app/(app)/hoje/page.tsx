import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
import { TodayBlocks } from "@/components/planner/TodayBlocks";
import { ContextualSuggestions } from "@/components/dashboard/ContextualSuggestions";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
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

      {/* Ações pendentes do dia */}
      {(!todayEntry || !todaySleep) && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Pendente hoje</h2>
          <div className="flex flex-wrap gap-2">
            {!todayEntry && (
              <Link
                href="/checkin"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
              >
                Fazer check-in
              </Link>
            )}
            {!todaySleep && (
              <Link
                href="/sono/novo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary no-underline hover:bg-primary/20"
              >
                Registrar sono
              </Link>
            )}
          </div>
        </Card>
      )}

      {todayEntry && todaySleep && (
        <Card className="border-green-200 bg-green-50/50">
          <p className="text-sm font-medium text-green-700">Tudo registrado hoje. Bom trabalho!</p>
        </Card>
      )}
    </div>
  );
}
