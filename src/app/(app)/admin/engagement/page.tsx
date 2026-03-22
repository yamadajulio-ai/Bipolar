import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { maskIp } from "@/lib/security";
import { Card } from "@/components/Card";

export default async function AdminEngagementPage() {
  const session = await getSession();

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_engagement",
      ip: maskIp(ip),
    },
  });

  const totalUsers = await prisma.user.count();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Feature adoption (distinct users)
  const [
    checkinUsers7d,
    sleepUsers7d,
    exerciseUsers30d,
    plannerUsers,
    assessmentUsers30d,
    lifeChartUsers,
    cognitiveUsers,
    financialUsers,
    contentViewUsers,
    courseUsers,
  ] = await Promise.all([
    prisma.diaryEntry.groupBy({ by: ["userId"], where: { createdAt: { gte: sevenDaysAgo } } }).then((r) => r.length),
    prisma.sleepLog.groupBy({ by: ["userId"], where: { createdAt: { gte: sevenDaysAgo } } }).then((r) => r.length),
    prisma.exerciseSession.groupBy({ by: ["userId"], where: { completedAt: { gte: thirtyDaysAgo } } }).then((r) => r.length),
    prisma.plannerBlock.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.weeklyAssessment.groupBy({ by: ["userId"], where: { createdAt: { gte: thirtyDaysAgo } } }).then((r) => r.length),
    prisma.lifeChartEvent.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.cognitiveTest.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.financialTransaction.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.contentView.groupBy({ by: ["userId"] }).then((r) => r.length),
    prisma.courseProgress.groupBy({ by: ["userId"] }).then((r) => r.length),
  ]);

  const featureAdoption = [
    { name: "Check-in diário", users: checkinUsers7d, period: "7d" },
    { name: "Registro de sono", users: sleepUsers7d, period: "7d" },
    { name: "Exercícios", users: exerciseUsers30d, period: "30d" },
    { name: "Planejador", users: plannerUsers, period: "total" },
    { name: "Avaliação semanal", users: assessmentUsers30d, period: "30d" },
    { name: "Life Chart", users: lifeChartUsers, period: "total" },
    { name: "Cognitivo", users: cognitiveUsers, period: "total" },
    { name: "Financeiro", users: financialUsers, period: "total" },
    { name: "Conteúdos", users: contentViewUsers, period: "total" },
    { name: "Cursos", users: courseUsers, period: "total" },
  ];

  // Integrations
  const [gcalConnected, haeActive, pushSubscribed] = await Promise.all([
    prisma.googleAccount.count(),
    prisma.integrationKey.count({ where: { service: "health_auto_export", enabled: true } }),
    prisma.pushSubscription.groupBy({ by: ["userId"] }).then((r) => r.length),
  ]);

  const lastGcalSync = await prisma.googleAccount.findFirst({
    orderBy: { lastSyncAt: "desc" },
    select: { lastSyncAt: true },
  });

  // Top content views
  const topContent = await prisma.contentView.groupBy({
    by: ["slug"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Contextual feedback rates
  const contextualRaw = await prisma.contextualFeedback.groupBy({
    by: ["contextKey", "useful"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 100,
  });

  const contextualMap = new Map<string, { yes: number; no: number }>();
  for (const row of contextualRaw) {
    if (!contextualMap.has(row.contextKey)) contextualMap.set(row.contextKey, { yes: 0, no: 0 });
    const entry = contextualMap.get(row.contextKey)!;
    if (row.useful) entry.yes += row._count.id;
    else entry.no += row._count.id;
  }

  // Group by feature prefix (insight:, content:, report:)
  const featureFeedback: Record<string, { yes: number; no: number }> = {};
  for (const [key, val] of contextualMap) {
    const prefix = key.split(":")[0];
    if (!featureFeedback[prefix]) featureFeedback[prefix] = { yes: 0, no: 0 };
    featureFeedback[prefix].yes += val.yes;
    featureFeedback[prefix].no += val.no;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Engajamento</h1>

      {/* Feature adoption */}
      <h2 className="text-lg font-semibold">Adoção de features</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="py-2 pr-3">Feature</th>
                <th className="py-2 pr-3">Período</th>
                <th className="py-2 pr-3">Usuários</th>
                <th className="py-2">% do total</th>
              </tr>
            </thead>
            <tbody>
              {featureAdoption.map((f) => {
                const pct = totalUsers > 0 ? Math.round((f.users / totalUsers) * 100) : 0;
                return (
                  <tr key={f.name} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{f.name}</td>
                    <td className="py-2 pr-3 text-xs text-muted">{f.period}</td>
                    <td className="py-2 pr-3">{f.users}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-surface-alt overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Integrations */}
      <h2 className="text-lg font-semibold">Integrações</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Google Calendar</p>
          <p className="text-2xl font-bold">{gcalConnected}</p>
          {lastGcalSync?.lastSyncAt && (
            <p className="text-xs text-muted mt-1">
              Último sync: {new Date(lastGcalSync.lastSyncAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-muted">Health Auto Export</p>
          <p className="text-2xl font-bold">{haeActive}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Push notifications</p>
          <p className="text-2xl font-bold">{pushSubscribed}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Total integrados</p>
          <p className="text-2xl font-bold">
            {gcalConnected + haeActive}
            <span className="text-sm font-normal text-muted">
              {" "}({totalUsers > 0 ? Math.round(((gcalConnected + haeActive) / totalUsers) * 100) : 0}%)
            </span>
          </p>
        </Card>
      </div>

      {/* Top content */}
      {topContent.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Conteúdos mais vistos</h2>
          <Card>
            <div className="space-y-2">
              {topContent.map((c, i) => (
                <div key={c.slug} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-muted w-4">{i + 1}.</span>
                  <span className="font-mono text-xs flex-1 truncate">{c.slug}</span>
                  <span className="font-medium">{c._count.id} views</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Contextual feedback by feature */}
      {Object.keys(featureFeedback).length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Feedback contextual por feature</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted">
                    <th className="py-2 pr-3">Feature</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Positivos</th>
                    <th className="py-2">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(featureFeedback)
                    .sort(([, a], [, b]) => (b.yes + b.no) - (a.yes + a.no))
                    .map(([key, val]) => {
                      const total = val.yes + val.no;
                      const rate = total > 0 ? Math.round((val.yes / total) * 100) : 0;
                      return (
                        <tr key={key} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono text-xs">{key}</td>
                          <td className="py-2 pr-3">{total}</td>
                          <td className="py-2 pr-3">{val.yes}</td>
                          <td className="py-2">
                            <span className={rate >= 70 ? "text-green-600" : rate >= 40 ? "text-amber-600" : "text-red-600"}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
