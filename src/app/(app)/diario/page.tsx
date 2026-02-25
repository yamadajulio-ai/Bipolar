import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";

const moodLabels: Record<number, string> = {
  1: "Muito baixo",
  2: "Baixo",
  3: "Neutro",
  4: "Elevado",
  5: "Muito elevado",
};

export default async function DiarioPage() {
  const session = await getSession();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];

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
        <Link
          href="/diario/novo"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
        >
          Novo registro
        </Link>
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
          {entries.map((entry) => (
            <Card key={entry.id}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-muted">
                    Humor: {moodLabels[entry.mood] || entry.mood} | Sono:{" "}
                    {entry.sleepHours}h
                  </p>
                </div>
                {entry.note && (
                  <p className="max-w-xs truncate text-xs text-muted">
                    {entry.note}
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
