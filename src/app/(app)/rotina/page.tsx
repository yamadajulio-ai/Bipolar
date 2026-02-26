import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

const anchorLabels: Record<string, string> = {
  wakeTime: "Acordou",
  firstContact: "1o contato",
  mainActivityStart: "Ativ. principal",
  dinnerTime: "Jantar",
  bedtime: "Dormir",
};

export default async function RotinaPage() {
  const session = await getSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const entries = await prisma.dailyRhythm.findMany({
    where: {
      userId: session.userId,
      date: { gte: cutoffStr },
    },
    orderBy: { date: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ritmo Social</h1>
        <Link
          href="/rotina/novo"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
        >
          Registrar hoje
        </Link>
      </div>

      <div className="mb-4">
        <Link
          href="/rotina/tendencias"
          className="text-sm text-primary hover:underline"
        >
          Ver tendencias e regularidade
        </Link>
      </div>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          O que e a Terapia de Ritmos Sociais?
        </h2>
        <p className="text-sm text-muted">
          A Terapia Interpessoal e de Ritmos Sociais (IPSRT) e uma abordagem
          desenvolvida especificamente para o transtorno bipolar. Ela reconhece que
          a estabilidade das rotinas diarias — como horarios de acordar, comer e
          dormir — tem impacto direto na regulacao do humor. Mudancas bruscas
          nesses ritmos podem desencadear episodios. Monitorar e manter
          regularidade nessas ancoras sociais e uma ferramenta poderosa para a
          estabilidade emocional.
        </p>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhum registro nos ultimos 7 dias.{" "}
            <Link href="/rotina/novo" className="text-primary hover:underline">
              Criar primeiro registro
            </Link>
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <p className="mb-2 text-sm font-medium">
                {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {(
                  ["wakeTime", "firstContact", "mainActivityStart", "dinnerTime", "bedtime"] as const
                ).map((key) => {
                  const val = entry[key];
                  if (!val) return null;
                  return (
                    <span key={key}>
                      <span className="font-medium text-foreground">
                        {anchorLabels[key]}:
                      </span>{" "}
                      {val}
                    </span>
                  );
                })}
              </div>
              {entry.notes && (
                <p className="mt-2 text-xs text-muted">{entry.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Alert variant="info" className="mt-6">
        Baseado na Terapia Interpessoal de Ritmos Sociais (IPSRT). Nao substitui
        acompanhamento profissional.
      </Alert>
    </div>
  );
}
