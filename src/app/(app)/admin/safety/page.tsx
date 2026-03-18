import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { maskIp } from "@/lib/security";
import { Card } from "@/components/Card";
import { AdminSOSChart } from "@/components/admin/AdminSOSChart";

const SOS_ACTION_LABELS: Record<string, string> = {
  opened: "Abriu SOS",
  called_188: "Ligou CVV 188",
  called_192: "Ligou SAMU 192",
  called_contact: "Ligou contato",
  breathing: "Respiração",
  grounding: "Aterramento",
};

export default async function AdminSafetyPage() {
  const session = await getSession();

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_safety",
      ip: maskIp(ip),
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const totalUsers = await prisma.user.count();

  // SOS events by type (30d)
  const sosByType = await prisma.sOSEvent.groupBy({
    by: ["action"],
    _count: { id: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { _count: { id: "desc" } },
  });

  // SOS timeline (daily, 30d)
  const sosEvents = await prisma.sOSEvent.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, action: true },
    orderBy: { createdAt: "asc" },
  });

  const sosTimeline: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    sosTimeline[d.toISOString().slice(0, 10)] = 0;
  }
  for (const ev of sosEvents) {
    const date = new Date(ev.createdAt).toISOString().slice(0, 10);
    if (sosTimeline[date] !== undefined) sosTimeline[date]++;
  }

  const sosChartData = Object.entries(sosTimeline).map(([date, count]) => ({
    date,
    count,
  }));

  // Last 20 SOS events with user email
  const recentSOS = await prisma.sOSEvent.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { email: true, name: true } } },
  });

  // PHQ-9 Item 9 >= 1 (latest assessment per user)
  const phq9HighRisk = await prisma.weeklyAssessment.findMany({
    where: { phq9Item9: { gte: 1 } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { email: true, name: true } } },
  });

  // PHQ-9 Item 9 weekly aggregate (last 12 weeks)
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  const phq9History = await prisma.weeklyAssessment.findMany({
    where: { createdAt: { gte: twelveWeeksAgo } },
    select: { phq9Item9: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by week
  const phq9WeeklyMap: Record<string, { total: number; elevated: number }> = {};
  for (const a of phq9History) {
    const weekStart = new Date(a.createdAt);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (!phq9WeeklyMap[key]) phq9WeeklyMap[key] = { total: 0, elevated: 0 };
    phq9WeeklyMap[key].total++;
    if ((a.phq9Item9 ?? 0) >= 1) phq9WeeklyMap[key].elevated++;
  }

  // High priority feedbacks
  const highPriorityFeedbacks = await prisma.feedback.findMany({
    where: { priority: "high" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { email: true, name: true } } },
  });

  // Crisis plans
  const [usersWithPlan, usersWithContacts] = await Promise.all([
    prisma.crisisPlan.count(),
    prisma.crisisPlan.count({
      where: {
        trustedContacts: { not: "[]" },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Segurança e Crise</h1>

      {/* SOS Events summary */}
      <h2 className="text-lg font-semibold">Eventos SOS (últimos 30 dias)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sosByType.map((s) => (
          <Card key={s.action}>
            <p className="text-xs text-muted">{SOS_ACTION_LABELS[s.action] ?? s.action}</p>
            <p className="text-2xl font-bold">{s._count.id}</p>
          </Card>
        ))}
        {sosByType.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Nenhum evento SOS nos últimos 30 dias.</p>
          </Card>
        )}
      </div>

      {/* SOS timeline chart */}
      <Card>
        <h3 className="text-sm font-semibold mb-2">Timeline SOS (30 dias)</h3>
        <AdminSOSChart data={sosChartData} />
      </Card>

      {/* Recent SOS events */}
      {recentSOS.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Últimos 20 eventos SOS</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Ação</th>
                    <th className="py-2">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSOS.map((ev) => (
                    <tr key={ev.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs">
                        {new Date(ev.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                          ev.action === "called_188" || ev.action === "called_192"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {SOS_ACTION_LABELS[ev.action] ?? ev.action}
                        </span>
                      </td>
                      <td className="py-2 text-xs">{ev.user.name ?? ev.user.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* PHQ-9 Item 9 */}
      <h2 className="text-lg font-semibold">PHQ-9 Ideação (item 9 ≥ 1)</h2>
      {phq9HighRisk.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Usuário</th>
                  <th className="py-2 pr-3">Item 9</th>
                  <th className="py-2">PHQ-9 Total</th>
                </tr>
              </thead>
              <tbody>
                {phq9HighRisk.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 text-xs">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td className="py-2 pr-3 text-xs">{a.user.name ?? a.user.email}</td>
                    <td className="py-2 pr-3">
                      <span className={`font-bold ${(a.phq9Item9 ?? 0) >= 2 ? "text-red-600" : "text-amber-600"}`}>
                        {a.phq9Item9 ?? 0}
                      </span>
                    </td>
                    <td className="py-2 text-xs">{a.phq9Total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">Nenhuma avaliação com item 9 elevado.</p>
        </Card>
      )}

      {/* PHQ-9 weekly trend */}
      {Object.keys(phq9WeeklyMap).length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Histórico semanal — Item 9 elevado</h3>
          <Card>
            <div className="space-y-1">
              {Object.entries(phq9WeeklyMap)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([week, data]) => (
                  <div key={week} className="flex items-center gap-3 text-xs">
                    <span className="w-20 text-muted">{week.slice(5).split("-").reverse().join("/")}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-alt overflow-hidden">
                      <div
                        className="h-full rounded-full bg-red-400"
                        style={{ width: `${data.total > 0 ? (data.elevated / data.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-muted">
                      {data.elevated}/{data.total}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </>
      )}

      {/* High priority feedbacks */}
      {highPriorityFeedbacks.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Feedbacks com sinal de risco</h2>
          <Card>
            <div className="space-y-3">
              {highPriorityFeedbacks.map((fb) => (
                <div key={fb.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      Sinal de risco
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(fb.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{fb.message}</p>
                  <p className="text-xs text-muted mt-1">{fb.user.name ?? fb.user.email}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Crisis plans */}
      <h2 className="text-lg font-semibold">Planos de crise</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Usuários com plano</p>
          <p className="text-2xl font-bold">
            {usersWithPlan}
            <span className="text-sm font-normal text-muted">
              {" "}({totalUsers > 0 ? Math.round((usersWithPlan / totalUsers) * 100) : 0}%)
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Com contatos de emergência</p>
          <p className="text-2xl font-bold">
            {usersWithContacts}
            <span className="text-sm font-normal text-muted">
              {" "}({usersWithPlan > 0 ? Math.round((usersWithContacts / usersWithPlan) * 100) : 0}%)
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}
