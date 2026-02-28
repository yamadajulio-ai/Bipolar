import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { TodayStatus } from "@/components/dashboard/TodayStatus";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ContextualSuggestions } from "@/components/dashboard/ContextualSuggestions";
import { DashboardChartWrapper } from "@/components/dashboard/DashboardChartWrapper";
import { Card } from "@/components/Card";
import { Greeting } from "@/components/Greeting";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();
  const today = localToday();

  const todayEntry = await prisma.diaryEntry.findFirst({
    where: { userId: session.userId, date: today },
  });

  const todaySleep = await prisma.sleepLog.findFirst({
    where: { userId: session.userId, date: today },
  });

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  const cutoffStr = localDateStr(last7Days);

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

  return (
    <div className="space-y-6">
      <Greeting />

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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                  </svg>
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
