import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { maskIp } from "@/lib/security";
import { Card } from "@/components/Card";

export default async function AdminCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const session = await getSession();

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const params = await searchParams;

  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_compliance",
      metadata: JSON.stringify({
        page: params.page,
        action: params.action,
      }),
      ip: maskIp(ip),
    },
  });

  const totalUsers = await prisma.user.count();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Consents
  const [healthConsents, termsConsents, recentRevocations] = await Promise.all([
    prisma.consent.count({ where: { scope: "health_data", revokedAt: null } }),
    prisma.consent.count({ where: { scope: "terms_of_use", revokedAt: null } }),
    prisma.consent.findMany({
      where: { revokedAt: { not: null, gte: thirtyDaysAgo } },
      orderBy: { revokedAt: "desc" },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
  ]);

  // Audit log
  const auditPage = Math.max(1, Number(params.page) || 1);
  const auditPerPage = 50;
  const auditWhere = params.action ? { action: params.action } : {};

  const [auditLogs, totalAuditLogs] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where: { ...auditWhere, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      skip: (auditPage - 1) * auditPerPage,
      take: auditPerPage,
    }),
    prisma.adminAuditLog.count({
      where: { ...auditWhere, createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const auditTotalPages = Math.ceil(totalAuditLogs / auditPerPage);

  // Distinct audit actions for filter
  const auditActions = await prisma.adminAuditLog.groupBy({
    by: ["action"],
    _count: { id: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { _count: { id: "desc" } },
  });

  // Professional access
  const [activeProfLinks, profAccessEvents, pinFailures] = await Promise.all([
    prisma.professionalAccess.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    }),
    prisma.accessLog.count({
      where: { action: "data_viewed", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.accessLog.count({
      where: { action: "pin_failed", createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  // Socioeconomic profile (aggregated)
  const socioProfiles = await prisma.socioeconomicProfile.findMany({
    select: { careAccess: true, medicationSource: true, consultFrequency: true },
  });

  const careAccessDist: Record<string, number> = {};
  const medSourceDist: Record<string, number> = {};
  const consultDist: Record<string, number> = {};

  for (const p of socioProfiles) {
    if (p.careAccess) careAccessDist[p.careAccess] = (careAccessDist[p.careAccess] || 0) + 1;
    if (p.medicationSource) medSourceDist[p.medicationSource] = (medSourceDist[p.medicationSource] || 0) + 1;
    if (p.consultFrequency) consultDist[p.consultFrequency] = (consultDist[p.consultFrequency] || 0) + 1;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Compliance</h1>

      {/* Consents */}
      <h2 className="text-lg font-semibold">Consentimentos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Health Data aceito</p>
          <p className="text-2xl font-bold">
            {healthConsents}
            <span className="text-sm font-normal text-muted"> / {totalUsers}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Terms of Use aceito</p>
          <p className="text-2xl font-bold">
            {termsConsents}
            <span className="text-sm font-normal text-muted"> / {totalUsers}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Revogações (30d)</p>
          <p className="text-2xl font-bold">{recentRevocations.length}</p>
        </Card>
      </div>

      {recentRevocations.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Revogações recentes</h3>
          <div className="space-y-1 text-xs">
            {recentRevocations.map((r) => (
              <div key={r.id} className="flex justify-between">
                <span>{r.user.email} — {r.scope}</span>
                <span className="text-muted">
                  {r.revokedAt ? new Date(r.revokedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Professional access */}
      <h2 className="text-lg font-semibold">Acessos profissionais</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Links ativos</p>
          <p className="text-2xl font-bold">{activeProfLinks}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Visualizações (30d)</p>
          <p className="text-2xl font-bold">{profAccessEvents}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">PIN failures (7d)</p>
          <p className={`text-2xl font-bold ${pinFailures > 0 ? "text-amber-600" : ""}`}>
            {pinFailures}
          </p>
        </Card>
      </div>

      {/* Socioeconomic (aggregated) */}
      {socioProfiles.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Perfil socioeconômico (agregado)</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <h3 className="text-xs font-semibold text-muted mb-2">Acesso a cuidado</h3>
              {Object.entries(careAccessDist).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span>{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {Object.keys(careAccessDist).length === 0 && (
                <p className="text-xs text-muted">Sem dados</p>
              )}
            </Card>
            <Card>
              <h3 className="text-xs font-semibold text-muted mb-2">Fonte de medicação</h3>
              {Object.entries(medSourceDist).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span>{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {Object.keys(medSourceDist).length === 0 && (
                <p className="text-xs text-muted">Sem dados</p>
              )}
            </Card>
            <Card>
              <h3 className="text-xs font-semibold text-muted mb-2">Frequência de consulta</h3>
              {Object.entries(consultDist).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span>{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              {Object.keys(consultDist).length === 0 && (
                <p className="text-xs text-muted">Sem dados</p>
              )}
            </Card>
          </div>
        </>
      )}

      {/* Audit log */}
      <h2 className="text-lg font-semibold">Audit Log (últimos 30 dias)</h2>

      <Card>
        <div className="flex flex-wrap gap-2 text-sm mb-4">
          <span className="font-medium">Filtro:</span>
          <a href="/admin/compliance" className={`px-2 py-1 rounded ${!params.action ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Todos
          </a>
          {auditActions.map((a) => (
            <a
              key={a.action}
              href={`/admin/compliance?action=${a.action}`}
              className={`px-2 py-1 rounded ${params.action === a.action ? "bg-primary text-white" : "bg-surface-alt"}`}
            >
              {a.action} ({a._count.id})
            </a>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Ação</th>
                <th className="py-2 pr-3">Metadata</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-xs">
                    {new Date(log.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </td>
                  <td className="py-2 pr-3 text-xs font-mono">{log.action}</td>
                  <td className="py-2 pr-3 text-xs font-mono max-w-xs truncate">
                    {log.metadata ?? "—"}
                  </td>
                  <td className="py-2 text-xs font-mono">{log.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit pagination */}
      {auditTotalPages > 1 && (
        <div className="flex justify-center gap-2">
          {auditPage > 1 && (
            <a
              href={`/admin/compliance?page=${auditPage - 1}${params.action ? `&action=${params.action}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm"
            >
              ← Anterior
            </a>
          )}
          <span className="px-3 py-1 text-sm text-muted">{auditPage}/{auditTotalPages}</span>
          {auditPage < auditTotalPages && (
            <a
              href={`/admin/compliance?page=${auditPage + 1}${params.action ? `&action=${params.action}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm"
            >
              Próxima →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
