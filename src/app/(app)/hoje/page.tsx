import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
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

const moodLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito deprimido", color: "text-red-600" },
  2: { text: "Deprimido", color: "text-orange-600" },
  3: { text: "Eutímico (estável)", color: "text-green-700" },
  4: { text: "Elevado", color: "text-amber-600" },
  5: { text: "Muito elevado", color: "text-red-600" },
};

const energyLabels: Record<number, { text: string; color: string }> = {
  1: { text: "Muito baixa", color: "text-red-600" },
  2: { text: "Baixa", color: "text-orange-600" },
  3: { text: "Normal", color: "text-green-700" },
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
          <Card className="border-green-200 bg-green-50/50 text-center py-5">
            <div className="text-2xl mb-1">&#9989;</div>
            <p className="font-semibold text-green-700">Check-in feito</p>
            <p className="text-xs text-green-600 mt-1">Humor, energia e medicação registrados</p>
          </Card>
        )}

        {!todaySleep ? (
          <Link href="/sono/novo" className="block no-underline">
            <Card className="border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors text-center py-5">
              <div className="text-2xl mb-1">&#127769;</div>
              <p className="font-semibold text-foreground">Registrar sono</p>
              <p className="text-xs text-muted mt-1">Como foi a noite passada?</p>
            </Card>
          </Link>
        ) : (
          <Card className="border-green-200 bg-green-50/50 text-center py-5">
            <div className="text-2xl mb-1">&#9989;</div>
            <p className="font-semibold text-green-700">Sono registrado</p>
            <p className="text-xs text-green-600 mt-1">{formatSleepDuration(todaySleep.totalHours)} dormidas</p>
          </Card>
        )}
      </div>

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
              <span className="text-sm text-muted">Medicação (hoje)</span>
              <span className={`text-sm font-medium ${todayEntry.tookMedication === "sim" ? "text-green-700" : todayEntry.tookMedication === "nao" ? "text-red-600" : "text-muted"}`}>
                {todayEntry.tookMedication === "sim" ? "Tomou" : todayEntry.tookMedication === "nao" ? "Não tomou" : "Não informado"}
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
              <div key={a.label} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm">
                <span className="font-medium text-indigo-700">{a.time}</span>
                <span className="ml-1.5 text-indigo-600">{a.label}</span>
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

      {/* === GRÁFICO 7 DIAS === */}
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
