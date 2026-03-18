import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { localDateStr } from "@/lib/dateUtils";
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

export default async function DiarioPage() {
  const session = await getSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = localDateStr(cutoff);

  const entries = await prisma.diaryEntry.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diário de Humor e Sono</h1>
        <div className="flex gap-2">
          <Link
            href="/diario/tendencias"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-alt"
          >
            Tendências
          </Link>
          <Link
            href="/diario/novo"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
          >
            Novo registro
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhum registro nos últimos 30 dias.{" "}
            <Link href="/diario/novo" className="text-primary hover:underline">
              Criar primeiro registro
            </Link>
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const signs: string[] = entry.warningSigns
              ? JSON.parse(entry.warningSigns)
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
                        preenchido às {new Date(entry.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </span>
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Humor: {MOOD_LABELS[entry.mood] || entry.mood} | Sono:{" "}
                      {entry.sleepHours}h
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
                    <p className="max-w-xs truncate text-xs text-muted">
                      {entry.note}
                    </p>
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
