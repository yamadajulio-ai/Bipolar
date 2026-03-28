import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { maskIp } from "@/lib/security";
import { Card } from "@/components/Card";
import { AdminActivityChart } from "@/components/admin/AdminActivityChart";

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");
  if (!session.onboarded) redirect("/onboarding");

  // RBAC: deny-by-default, require admin role (defense-in-depth — layout also checks)
  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (adminUser?.role !== "admin") redirect("/hoje");

  // Audit log
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_overview",
      ip: maskIp(ip),
    },
  });

  const now = new Date();
  const todayStart = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  todayStart.setHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalUsers,
    onboardedUsers,
    newUsers7d,
    newUsers30d,
    checkinsToday,
    sleepToday,
    exercisesToday,
    sosToday,
    checkins7d,
    sleep7d,
    exercises7d,
    feedbacks7d,
    highPriorityFeedbacks,
    sos24h,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { onboarded: true } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.diaryEntry.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.sleepLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.exerciseSession.count({ where: { completedAt: { gte: todayStart } } }),
    prisma.sOSEvent.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.diaryEntry.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.sleepLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.exerciseSession.count({ where: { completedAt: { gte: sevenDaysAgo } } }),
    prisma.feedback.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.feedback.count({ where: { priority: "high" } }),
    prisma.sOSEvent.count({ where: { createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
  ]);

  // Activity chart data (last 30 days) — fetch all at once, group in JS
  const [allCheckins, allSleep, allExercises] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.sleepLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.exerciseSession.findMany({
      where: { completedAt: { gte: thirtyDaysAgo } },
      select: { completedAt: true },
    }),
  ]);

  const chartMap: Record<string, { checkins: number; sleep: number; exercises: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    chartMap[d.toISOString().slice(0, 10)] = { checkins: 0, sleep: 0, exercises: 0 };
  }
  for (const c of allCheckins) {
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
    if (chartMap[key]) chartMap[key].checkins++;
  }
  for (const s of allSleep) {
    const key = new Date(s.createdAt).toISOString().slice(0, 10);
    if (chartMap[key]) chartMap[key].sleep++;
  }
  for (const e of allExercises) {
    const key = new Date(e.completedAt).toISOString().slice(0, 10);
    if (chartMap[key]) chartMap[key].exercises++;
  }
  const chartData = Object.entries(chartMap).map(([date, counts]) => ({ date, ...counts }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin — Overview</h1>

      {/* User stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total usuários</p>
          <p className="text-2xl font-bold">{totalUsers}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Onboarded</p>
          <p className="text-2xl font-bold">{onboardedUsers}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Novos (7d)</p>
          <p className="text-2xl font-bold">{newUsers7d}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Novos (30d)</p>
          <p className="text-2xl font-bold">{newUsers30d}</p>
        </Card>
      </div>

      {/* Activity today */}
      <h2 className="text-lg font-semibold">Atividade hoje</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Check-ins</p>
          <p className="text-2xl font-bold">{checkinsToday}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Registros de sono</p>
          <p className="text-2xl font-bold">{sleepToday}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Exercícios</p>
          <p className="text-2xl font-bold">{exercisesToday}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Eventos SOS</p>
          <p className={`text-2xl font-bold ${sosToday > 0 ? "text-red-600" : ""}`}>{sosToday}</p>
        </Card>
      </div>

      {/* Activity 7d */}
      <h2 className="text-lg font-semibold">Atividade últimos 7 dias</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Check-ins</p>
          <p className="text-2xl font-bold">{checkins7d}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Sono</p>
          <p className="text-2xl font-bold">{sleep7d}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Exercícios</p>
          <p className="text-2xl font-bold">{exercises7d}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Feedbacks</p>
          <p className="text-2xl font-bold">{feedbacks7d}</p>
        </Card>
      </div>

      {/* Alerts */}
      {(highPriorityFeedbacks > 0 || sos24h > 0) && (
        <>
          <h2 className="text-lg font-semibold">Alertas</h2>
          <div className="grid grid-cols-2 gap-3">
            {highPriorityFeedbacks > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <p className="text-xs text-muted">Feedbacks com sinal de risco</p>
                <p className="text-2xl font-bold text-red-600">{highPriorityFeedbacks}</p>
              </Card>
            )}
            {sos24h > 0 && (
              <Card className="border-l-4 border-l-amber-500">
                <p className="text-xs text-muted">SOS últimas 24h</p>
                <p className="text-2xl font-bold text-amber-600">{sos24h}</p>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Activity chart */}
      <h2 className="text-lg font-semibold">Atividade diária (30 dias)</h2>
      <Card>
        <AdminActivityChart data={chartData} />
      </Card>
    </div>
  );
}
