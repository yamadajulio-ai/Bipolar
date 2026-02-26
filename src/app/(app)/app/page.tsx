import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TodayStatus } from "@/components/dashboard/TodayStatus";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ContextualSuggestions } from "@/components/dashboard/ContextualSuggestions";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import { Card } from "@/components/Card";

export default async function DashboardPage() {
  const session = await getSession();
  const today = new Date().toISOString().split("T")[0];

  const todayEntry = await prisma.diaryEntry.findFirst({
    where: { userId: session.userId, date: today },
  });

  const todaySleep = await prisma.sleepLog.findFirst({
    where: { userId: session.userId, date: today },
  });

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const cutoffStr = last7Days.toISOString().split("T")[0];

  const recentEntries = await prisma.diaryEntry.findMany({
    where: { userId: session.userId, date: { gte: cutoffStr } },
    orderBy: { date: "asc" },
  });

  const lastEntry = await prisma.diaryEntry.findFirst({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
  });

  let daysSinceLastEntry: number | null = null;
  if (lastEntry) {
    const lastDate = new Date(lastEntry.date + "T12:00:00");
    const now = new Date();
    daysSinceLastEntry = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Generate alerts from recent entries
  const recentAlerts: string[] = [];
  if (recentEntries.length >= 3) {
    const last3 = recentEntries.slice(-3);
    if (last3[0].sleepHours > last3[1].sleepHours && last3[1].sleepHours > last3[2].sleepHours) {
      recentAlerts.push("Seu sono está diminuindo progressivamente. Alterações no sono podem preceder episódios. Este alerta é automático e não substitui avaliação profissional.");
    }
    if (last3.every((e) => e.mood >= 4)) {
      recentAlerts.push("Humor elevado persistente detectado. Converse com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }
    if (last3.every((e) => e.mood <= 2)) {
      recentAlerts.push("Humor baixo persistente. Considere conversar com seu profissional de saúde. Este alerta é automático e não substitui avaliação profissional.");
    }
  }

  const chartData = recentEntries.map((e) => ({
    date: e.date,
    mood: e.mood,
    sleepHours: e.sleepHours,
  }));

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{greeting}</h1>

      <ContextualSuggestions
        hasTodayEntry={!!todayEntry}
        hasTodaySleep={!!todaySleep}
        daysSinceLastEntry={daysSinceLastEntry}
        recentAlerts={recentAlerts}
      />

      <TodayStatus
        todayEntry={
          todayEntry
            ? { mood: todayEntry.mood, sleepHours: todayEntry.sleepHours, energyLevel: todayEntry.energyLevel }
            : null
        }
      />

      {chartData.length >= 2 && (
        <Card>
          <h2 className="mb-3 font-semibold text-foreground">Últimos 7 dias</h2>
          <DashboardChartWrapper data={chartData} />
          <a href="/diario/tendencias" className="mt-2 inline-block text-sm text-primary hover:underline">
            Ver tendências completas
          </a>
        </Card>
      )}

      <div>
        <h2 className="mb-3 font-semibold text-foreground">Acesso rápido</h2>
        <QuickActions />
      </div>
    </div>
  );
}
