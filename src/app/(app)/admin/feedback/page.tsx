import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { maskIp } from "@/lib/security";
import { FEEDBACK_CATEGORY_LABELS } from "@/lib/feedback";
import { RevealEmail } from "@/components/feedback/RevealEmail";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; priority?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/hoje");

  // RBAC: deny-by-default, require admin role
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (user?.role !== "admin") redirect("/hoje");

  const params = await searchParams;
  const categoryFilter = params.category || undefined;
  const priorityFilter = params.priority || undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const perPage = 20;

  const where = {
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
  };

  // Log admin access
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.adminAuditLog.create({
    data: {
      userId: session.userId,
      action: "view_feedbacks",
      metadata: JSON.stringify({
        filters: { category: categoryFilter, priority: priorityFilter, page },
      }),
      ip: maskIp(ip),
    },
  });

  const [feedbacks, totalFeedbacks, totalContextual, highPriorityCount] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { user: { select: { email: true } } },
    }),
    prisma.feedback.count({ where }),
    prisma.contextualFeedback.count(),
    prisma.feedback.count({ where: { priority: "high" } }),
  ]);

  // Contextual stats
  const contextualRaw = await prisma.contextualFeedback.groupBy({
    by: ["contextKey", "useful"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 100,
  });

  const contextualMap = new Map<string, { yes: number; no: number }>();
  for (const row of contextualRaw) {
    const key = row.contextKey;
    if (!contextualMap.has(key)) contextualMap.set(key, { yes: 0, no: 0 });
    const entry = contextualMap.get(key)!;
    if (row.useful) entry.yes += row._count.id;
    else entry.no += row._count.id;
  }

  const contextualEntries = [...contextualMap.entries()]
    .map(([key, val]) => ({
      contextKey: key,
      total: val.yes + val.no,
      positiveRate: (val.yes + val.no) > 0 ? Math.round((val.yes / (val.yes + val.no)) * 100) : 0,
      ...val,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const totalPages = Math.ceil(totalFeedbacks / perPage);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Feedback — Backoffice</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total feedbacks</p>
          <p className="text-2xl font-bold">{totalFeedbacks}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Sinal de risco</p>
          <p className="text-2xl font-bold text-red-600">{highPriorityCount}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Feedback contextual</p>
          <p className="text-2xl font-bold">{totalContextual}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Página</p>
          <p className="text-2xl font-bold">{page}/{totalPages || 1}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="font-medium">Filtros:</span>
          <a href="/admin/feedback" className={`px-2 py-1 rounded ${!categoryFilter && !priorityFilter ? "bg-primary text-white" : "bg-surface-alt"}`}>
            Todos
          </a>
          {Object.entries(FEEDBACK_CATEGORY_LABELS).map(([key, label]) => (
            <a key={key} href={`/admin/feedback?category=${key}`} className={`px-2 py-1 rounded ${categoryFilter === key ? "bg-primary text-white" : "bg-surface-alt"}`}>
              {label}
            </a>
          ))}
          <a href="/admin/feedback?priority=high" className={`px-2 py-1 rounded ${priorityFilter === "high" ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}>
            Sinal de risco
          </a>
        </div>
      </Card>

      {/* Feedback list */}
      {feedbacks.length === 0 && (
        <Alert variant="info">Nenhum feedback encontrado com os filtros selecionados.</Alert>
      )}

      <div className="space-y-3">
        {feedbacks.map((fb) => (
          <Card key={fb.id} className={fb.priority === "high" ? "border-l-4 border-l-red-500" : ""}>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                  fb.category === "bug" ? "bg-red-100 text-red-700" :
                  fb.category === "suggestion" ? "bg-blue-100 text-blue-700" :
                  fb.category === "praise" ? "bg-green-100 text-green-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {FEEDBACK_CATEGORY_LABELS[fb.category as keyof typeof FEEDBACK_CATEGORY_LABELS] ?? fb.category}
                </span>
                {fb.priority === "high" && (
                  <span className="inline-block rounded bg-amber-600 px-1.5 py-0.5 text-xs font-medium text-white">
                    Sinal automático de risco
                  </span>
                )}
                {fb.screen && (
                  <span className="text-xs text-muted">Tela: {fb.screen}</span>
                )}
                {fb.canContact && (
                  <span className="text-xs text-green-600">Aceita contato</span>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{fb.message}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                {/* Email masked by default, reveal-on-click only when canContact=true */}
                {fb.canContact ? (
                  <RevealEmail masked={maskEmail(fb.user.email)} full={fb.user.email} feedbackId={fb.id} />
                ) : (
                  <span>{maskEmail(fb.user.email)}</span>
                )}
                <span>{new Date(fb.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                {fb.route && <span>Origem: {fb.route}</span>}
                {fb.clientType && <span>Cliente: {fb.clientType}</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <a href={`/admin/feedback?page=${page - 1}${categoryFilter ? `&category=${categoryFilter}` : ""}${priorityFilter ? `&priority=${priorityFilter}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm">
              ← Anterior
            </a>
          )}
          {page < totalPages && (
            <a href={`/admin/feedback?page=${page + 1}${categoryFilter ? `&category=${categoryFilter}` : ""}${priorityFilter ? `&priority=${priorityFilter}` : ""}`}
              className="rounded bg-surface-alt px-3 py-1 text-sm">
              Próxima →
            </a>
          )}
        </div>
      )}

      {/* Contextual feedback stats */}
      <h2 className="text-lg font-bold mt-8">Feedback Contextual</h2>
      {contextualEntries.length === 0 ? (
        <Alert variant="info">Nenhum feedback contextual registrado ainda.</Alert>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="py-2 pr-4">Context Key</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Positivo</th>
                  <th className="py-2">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {contextualEntries.map((entry) => (
                  <tr key={entry.contextKey} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{entry.contextKey}</td>
                    <td className="py-2 pr-4">{entry.total}</td>
                    <td className="py-2 pr-4">{entry.yes}</td>
                    <td className="py-2">
                      <span className={entry.positiveRate >= 70 ? "text-green-600" : entry.positiveRate >= 40 ? "text-amber-600" : "text-red-600"}>
                        {entry.positiveRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
