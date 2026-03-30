import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { localDateStr } from "@/lib/dateUtils";
import { Card } from "@/components/Card";
import {
  MOOD_LABELS,
  ENERGY_LABELS,
  ANXIETY_LABELS,
  IRRITABILITY_LABELS,
} from "@/lib/constants";

function levelColor(level: number): string {
  if (level <= 1) return "bg-danger/20 text-danger";
  if (level <= 2) return "bg-warning/20 text-foreground";
  if (level <= 3) return "bg-muted/20 text-muted";
  if (level <= 4) return "bg-info/20 text-info";
  return "bg-primary/20 text-primary";
}

function medicationLabel(value: string | null): string | null {
  if (!value) return null;
  if (value === "sim") return "Medicou";
  if (value === "nao") return "Não medicou";
  return "Ainda não";
}

export default async function ViewerDiarioPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = localDateStr(cutoff);

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: session.patientUserId, date: { gte: cutoffStr } },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Diário de Humor e Sono</h1>
        <p className="text-sm text-muted mt-1">Histórico de {session.patientName} — últimos 30 dias</p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-center text-muted">Nenhum registro de humor nos últimos 30 dias.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const signs: string[] = entry.warningSigns
              ? (() => { try { return JSON.parse(entry.warningSigns as string); } catch { return []; } })()
              : [];
            const med = medicationLabel(entry.tookMedication);

            return (
              <Card key={entry.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      <span className="ml-2 text-xs font-normal text-muted">
                        às {new Date(entry.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Humor: {MOOD_LABELS[entry.mood] || entry.mood} | Sono: {entry.sleepHours}h
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.energyLevel != null && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(entry.energyLevel)}`}>
                          Energia: {ENERGY_LABELS[entry.energyLevel]}
                        </span>
                      )}
                      {entry.anxietyLevel != null && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(5 - entry.anxietyLevel)}`}>
                          Ansiedade: {ANXIETY_LABELS[entry.anxietyLevel]}
                        </span>
                      )}
                      {entry.irritability != null && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelColor(5 - entry.irritability)}`}>
                          Irritabilidade: {IRRITABILITY_LABELS[entry.irritability]}
                        </span>
                      )}
                      {med && (
                        <span className="inline-flex items-center rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted">
                          {med}
                        </span>
                      )}
                      {signs.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-foreground">
                          {signs.length} sinal(is) de alerta
                        </span>
                      )}
                    </div>
                  </div>
                  {entry.note && (
                    <p className="max-w-xs truncate text-xs text-muted">{entry.note}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
