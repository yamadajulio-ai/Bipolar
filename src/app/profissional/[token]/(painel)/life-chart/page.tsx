import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  medication_change: { label: "Mudança de medicação", color: "bg-primary/10 text-primary" },
  hospitalization: { label: "Hospitalização", color: "bg-danger-bg-subtle text-danger-fg" },
  episode: { label: "Episódio", color: "bg-warning-bg-subtle text-warning-fg" },
  therapy_start: { label: "Início de terapia", color: "bg-success-bg-subtle text-success-fg" },
  therapy_end: { label: "Fim de terapia", color: "bg-surface-alt text-muted" },
  life_event: { label: "Evento de vida", color: "bg-info-bg-subtle text-info-fg" },
  stressor: { label: "Estressor", color: "bg-warning-bg-subtle text-warning-fg" },
  achievement: { label: "Conquista", color: "bg-success-bg-subtle text-success-fg" },
};

export default async function ViewerLifeChartPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const events = await prisma.lifeChartEvent.findMany({
    where: { userId: session.patientUserId },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Life Chart</h1>
        <p className="text-sm text-muted mt-1">Eventos significativos de {session.patientName}</p>
      </div>

      {events.length === 0 ? (
        <Card>
          <p className="text-center text-muted">Nenhum evento registrado no Life Chart.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const typeInfo = EVENT_TYPE_LABELS[event.eventType] ?? {
              label: event.eventType,
              color: "bg-surface-alt text-muted",
            };

            return (
              <Card key={event.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 text-right w-16">
                    <p className="text-sm font-medium text-foreground">
                      {new Date(event.date + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </p>
                    <p className="text-[11px] text-muted">
                      {new Date(event.date + "T12:00:00").getFullYear()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    {event.notes && (
                      <p className="text-xs text-muted mt-1">{event.notes}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
