import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  depressao: { label: "Depressão", color: "bg-mood-depression-bg-subtle text-mood-depression-fg" },
  depressao_leve: { label: "Humor baixo", color: "bg-mood-depression-light-bg-subtle text-mood-depression-light-fg" },
  eutimia: { label: "Estável", color: "bg-mood-euthymia-bg-subtle text-mood-euthymia-fg" },
  hipomania: { label: "Elevado", color: "bg-mood-mania-bg-subtle text-mood-mania-fg" },
  mania: { label: "Mania", color: "bg-mood-mania-high-bg-subtle text-mood-mania-high-fg" },
};

const TYPE_LABELS: Record<string, string> = {
  free: "Livre",
  gratitude: "Gratidão",
  worry: "Preocupação",
  snapshot: "Momento",
};

export default async function ViewerMeuDiarioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const entries = await prisma.journalEntry.findMany({
    where: { userId: session.patientUserId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      content: true,
      zoneAtCapture: true,
      mixedAtCapture: true,
      entryDateLocal: true,
      createdAt: true,
    },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Diário</h1>
        <p className="text-sm text-muted mt-1">Pensamentos e sentimentos de {session.patientName}</p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-center text-muted">Nenhuma entrada no diário ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const zone = ZONE_LABELS[entry.zoneAtCapture ?? ""] ?? null;
            return (
              <Card key={entry.id}>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-muted">
                    {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                  {entry.type && (
                    <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-muted">
                      {TYPE_LABELS[entry.type] || entry.type}
                    </span>
                  )}
                  {zone && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${zone.color}`}>
                      {zone.label}
                    </span>
                  )}
                  {entry.mixedAtCapture && (
                    <span className="rounded-full bg-warning-bg-subtle px-2 py-0.5 text-[11px] text-warning-fg">
                      Misto
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {entry.content}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
