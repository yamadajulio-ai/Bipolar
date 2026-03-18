import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { maskIp, maskEmail } from "@/lib/security";
import { Card } from "@/components/Card";
import { RevealPII } from "@/components/admin/RevealPII";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    onboarded?: string;
    provider?: string;
    active?: string;
  }>;
}) {
  const session = await getSession();

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const params = await searchParams;

  // Audit log — only filters, no PII
  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_users",
      metadata: JSON.stringify({
        page: params.page,
        onboarded: params.onboarded,
        provider: params.provider,
        active: params.active,
      }),
      ip: maskIp(ip),
    },
  });

  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  // Build where clause
  const where: Record<string, unknown> = {};
  if (params.onboarded === "true") where.onboarded = true;
  if (params.onboarded === "false") where.onboarded = false;
  if (params.provider) where.authProvider = params.provider;

  if (params.active === "7d") {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    where.entries = { some: { createdAt: { gte: sevenDaysAgo } } };
  } else if (params.active === "30d") {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    where.entries = { some: { createdAt: { gte: thirtyDaysAgo } } };
  }

  const [users, totalUsers, totalOnboarded, withPush, withCrisisPlan] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        entries: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { date: true },
        },
        sleepLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { date: true },
        },
        _count: {
          select: {
            entries: true,
            sleepLogs: true,
            pushSubscriptions: true,
          },
        },
        googleAccount: { select: { id: true } },
        integrationKeys: { where: { enabled: true }, select: { service: true } },
        crisisPlan: { select: { id: true } },
        professionalAccesses: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.count({ where: { onboarded: true } }),
    prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
    prisma.user.count({ where: { crisisPlan: { isNot: null } } }),
  ]);

  const totalAll = await prisma.user.count();
  const totalPages = Math.ceil(totalUsers / perPage);

  // Provider distribution
  const providers = await prisma.user.groupBy({
    by: ["authProvider"],
    _count: { id: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Usuários</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card>
          <p className="text-xs text-muted">Total</p>
          <p className="text-2xl font-bold">{totalAll}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Onboarded</p>
          <p className="text-2xl font-bold">
            {totalOnboarded}{" "}
            <span className="text-sm font-normal text-muted">
              ({totalAll > 0 ? Math.round((totalOnboarded / totalAll) * 100) : 0}%)
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Com push</p>
          <p className="text-2xl font-bold">
            {withPush}{" "}
            <span className="text-sm font-normal text-muted">
              ({totalAll > 0 ? Math.round((withPush / totalAll) * 100) : 0}%)
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Plano de crise</p>
          <p className="text-2xl font-bold">
            {withCrisisPlan}{" "}
            <span className="text-sm font-normal text-muted">
              ({totalAll > 0 ? Math.round((withCrisisPlan / totalAll) * 100) : 0}%)
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Provedores</p>
          <div className="text-xs mt-1 space-y-0.5">
            {providers.map((p) => (
              <div key={p.authProvider ?? "email"}>
                <span className="font-medium">{p.authProvider ?? "email"}</span>: {p._count.id}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="font-medium">Filtros:</span>
          <a href="/admin/users" className={`px-2 py-1 rounded ${!params.onboarded && !params.provider && !params.active ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Todos
          </a>
          <a href="/admin/users?onboarded=true" className={`px-2 py-1 rounded ${params.onboarded === "true" ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Onboarded
          </a>
          <a href="/admin/users?onboarded=false" className={`px-2 py-1 rounded ${params.onboarded === "false" ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Não onboarded
          </a>
          <a href="/admin/users?active=7d" className={`px-2 py-1 rounded ${params.active === "7d" ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Ativos 7d
          </a>
          <a href="/admin/users?active=30d" className={`px-2 py-1 rounded ${params.active === "30d" ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Ativos 30d
          </a>
        </div>
      </Card>

      {/* Users table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted">
                <th className="py-2 pr-3">Usuário</th>
                <th className="py-2 pr-3">Auth</th>
                <th className="py-2 pr-3">Onboarded</th>
                <th className="py-2 pr-3">Criado em</th>
                <th className="py-2 pr-3">Último check-in</th>
                <th className="py-2 pr-3">Último sono</th>
                <th className="py-2 pr-3">Check-ins</th>
                <th className="py-2 pr-3">Sono</th>
                <th className="py-2 pr-3">Integrações</th>
                <th className="py-2 pr-3">Push</th>
                <th className="py-2 pr-3">Crise</th>
                <th className="py-2">Prof.</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const integrations: string[] = [];
                if (u.googleAccount) integrations.push("GCal");
                u.integrationKeys.forEach((ik) => {
                  if (ik.service === "health_auto_export") integrations.push("HAE");
                });

                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{u.name ?? "—"}</div>
                      <RevealPII
                        masked={maskEmail(u.email)}
                        full={u.email}
                        entityType="user"
                        entityId={u.id}
                      />
                    </td>
                    <td className="py-2 pr-3 text-xs">{u.authProvider ?? "email"}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs ${u.onboarded ? "text-green-600" : "text-muted"}`}>
                        {u.onboarded ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {u.entries[0]?.date
                        ? new Date(u.entries[0].date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {u.sleepLogs[0]?.date
                        ? new Date(u.sleepLogs[0].date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                        : "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{u._count.entries}</td>
                    <td className="py-2 pr-3 text-xs">{u._count.sleepLogs}</td>
                    <td className="py-2 pr-3 text-xs">
                      {integrations.length > 0 ? integrations.join(", ") : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs ${u._count.pushSubscriptions > 0 ? "text-green-600" : "text-muted"}`}>
                        {u._count.pushSubscriptions > 0 ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs ${u.crisisPlan ? "text-green-600" : "text-muted"}`}>
                        {u.crisisPlan ? "Sim" : "Não"}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs ${u.professionalAccesses.length > 0 ? "text-green-600" : "text-muted"}`}>
                        {u.professionalAccesses.length > 0 ? "Sim" : "Não"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a
              href={`/admin/users?page=${page - 1}${params.onboarded ? `&onboarded=${params.onboarded}` : ""}${params.provider ? `&provider=${params.provider}` : ""}${params.active ? `&active=${params.active}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm"
            >
              ← Anterior
            </a>
          )}
          <span className="px-3 py-1 text-sm text-muted">
            {page}/{totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`/admin/users?page=${page + 1}${params.onboarded ? `&onboarded=${params.onboarded}` : ""}${params.provider ? `&provider=${params.provider}` : ""}${params.active ? `&active=${params.active}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm"
            >
              Próxima →
            </a>
          )}
        </div>
      )}

      <p className="text-xs text-muted text-center">
        Mostrando {users.length} de {totalUsers} usuários
        {totalUsers !== totalAll && ` (${totalAll} total)`}
      </p>
    </div>
  );
}
