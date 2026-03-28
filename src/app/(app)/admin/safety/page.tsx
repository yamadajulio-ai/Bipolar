import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { maskIp, maskEmail } from "@/lib/security";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { AdminSOSChartLazy as AdminSOSChart } from "@/components/admin/AdminSOSChartLazy";
import { RevealPII } from "@/components/admin/RevealPII";

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
  if (!session.isLoggedIn) redirect("/login");
  if (!session.onboarded) redirect("/onboarding");

  // RBAC: deny-by-default
  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (adminUser?.role !== "admin") redirect("/hoje");

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

  // Last 20 SOS events — masked by default
  const recentSOS = await prisma.sOSEvent.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  // PHQ-9 Item 9 weekly aggregate (last 12 weeks) — NO individual data
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

  // PHQ-9 aggregate stats (no individual list)
  const phq9ElevatedTotal = phq9History.filter((a) => (a.phq9Item9 ?? 0) >= 1).length;
  const phq9ElevatedUsers = new Set(
    (await prisma.weeklyAssessment.findMany({
      where: { phq9Item9: { gte: 1 }, createdAt: { gte: twelveWeeksAgo } },
      select: { userId: true },
    })).map((a) => a.userId)
  ).size;

  // High priority feedbacks — count only, no raw messages
  const highPriorityCount = await prisma.feedback.count({
    where: { priority: "high" },
  });
  const highPriority30d = await prisma.feedback.count({
    where: { priority: "high", createdAt: { gte: thirtyDaysAgo } },
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

      <Alert variant="warning">
        Esta página contém dados sensíveis. Emails são mascarados por padrão.
        Revelar dados individuais é registrado no audit log.
        Este painel não substitui monitoramento clínico profissional.
      </Alert>

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

      {/* Recent SOS events — masked emails */}
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
                            ? "bg-danger-bg-subtle text-danger-fg"
                            : "bg-warning-bg-subtle text-warning-fg"
                        }`}>
                          {SOS_ACTION_LABELS[ev.action] ?? ev.action}
                        </span>
                      </td>
                      <td className="py-2 text-xs">
                        {ev.user ? (
                          <RevealPII
                            masked={maskEmail(ev.user.email)}
                            full={ev.user.name ?? ev.user.email}
                            entityType="sos_event"
                            entityId={ev.id}
                          />
                        ) : (
                          <span className="text-muted italic">Anônimo</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* PHQ-9 — AGGREGATED ONLY, no individual list */}
      <h2 className="text-lg font-semibold">PHQ-9 Ideação (agregado)</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Avaliações com item 9 ≥ 1 (12 sem.)</p>
          <p className="text-2xl font-bold">{phq9ElevatedTotal}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Usuários distintos</p>
          <p className="text-2xl font-bold">{phq9ElevatedUsers}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Total avaliações (12 sem.)</p>
          <p className="text-2xl font-bold">{phq9History.length}</p>
        </Card>
      </div>

      {/* PHQ-9 weekly trend */}
      {Object.keys(phq9WeeklyMap).length > 0 && (
        <>
          <h3 className="text-sm font-semibold">Tendência semanal — Item 9 elevado</h3>
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

      {/* High priority feedbacks — count only, no raw text */}
      <h2 className="text-lg font-semibold">Feedbacks com sinal de risco</h2>
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-muted">Total (todos os tempos)</p>
          <p className={`text-2xl font-bold ${highPriorityCount > 0 ? "text-danger-fg" : ""}`}>
            {highPriorityCount}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Últimos 30 dias</p>
          <p className={`text-2xl font-bold ${highPriority30d > 0 ? "text-danger-fg" : ""}`}>
            {highPriority30d}
          </p>
        </Card>
      </div>
      <p className="text-xs text-muted">
        Detalhes dos feedbacks de risco disponíveis em{" "}
        <a href="/admin/feedback?priority=high" className="underline">
          Feedback → Sinal de risco
        </a>
      </p>

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
