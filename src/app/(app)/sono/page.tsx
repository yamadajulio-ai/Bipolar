import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { localDateStr } from "@/lib/dateUtils";

function qualityPct(quality: number): number {
  // Normalize: old manual entries are 1-5, health export entries are 0-100
  return quality <= 5 ? quality * 20 : quality;
}

function qualityLabel(pct: number): string {
  if (pct >= 80) return "Ótima";
  if (pct >= 60) return "Boa";
  if (pct >= 40) return "Regular";
  if (pct >= 20) return "Ruim";
  return "Péssima";
}

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default async function SonoPage() {
  const session = await getSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = localDateStr(cutoff);

  const logs = await prisma.sleepLog.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Registro de Sono</h1>
        <Link
          href="/sono/novo"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
        >
          Novo registro
        </Link>
      </div>

      <div className="mb-4">
        <Link
          href="/sono/tendencias"
          className="text-sm text-primary hover:underline"
        >
          Ver tendencias e graficos &rarr;
        </Link>
      </div>

      {logs.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhum registro de sono nos ultimos 30 dias.{" "}
            <Link href="/sono/novo" className="text-primary hover:underline">
              Criar primeiro registro
            </Link>
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(log.date + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {log.bedtime} &rarr; {log.wakeTime} | {formatSleepDuration(log.totalHours)} de sono
                  </p>
                  <p className="text-xs text-muted">
                    Qualidade: {qualityPct(log.quality)}% ({qualityLabel(qualityPct(log.quality))})
                    {log.awakenings > 0 && (
                      <span> | {log.awakenings} despertar{log.awakenings > 1 ? "es" : ""}</span>
                    )}
                  </p>
                </div>
                {log.notes && (
                  <p className="max-w-xs truncate text-xs text-muted">
                    {log.notes}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
