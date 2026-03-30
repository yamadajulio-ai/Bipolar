import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";

export default async function ViewerAvaliacoesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const userId = session.patientUserId;

  const [weeklyAssessments, functioningAssessments] = await Promise.all([
    prisma.weeklyAssessment.findMany({
      where: { userId },
      select: {
        date: true,
        asrmTotal: true,
        phq9Total: true,
        phq9Item9: true,
        fastAvg: true,
        notes: true,
        createdAt: true,
      },
      orderBy: { date: "desc" },
      take: 24,
    }),
    prisma.functioningAssessment.findMany({
      where: { userId },
      select: {
        date: true,
        work: true,
        social: true,
        selfcare: true,
        finances: true,
        cognition: true,
        leisure: true,
        avgScore: true,
      },
      orderBy: { date: "desc" },
      take: 12,
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Avaliações Semanais</h1>
        <p className="text-sm text-muted mt-1">
          Histórico de {session.patientName} — ASRM / PHQ-9 / FAST
        </p>
      </div>

      {weeklyAssessments.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhuma avaliação semanal registrada ainda.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-alt dark:bg-surface-raised">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Semana</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted">ASRM</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted">PHQ-9</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted">Item 9</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-muted">FAST</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted">Notas</th>
                </tr>
              </thead>
              <tbody>
                {weeklyAssessments.map((a) => (
                  <tr key={a.date} className="border-t border-border">
                    <td className="px-3 py-2 text-sm">
                      {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </td>
                    <td className={`px-3 py-2 text-center font-medium ${
                      a.asrmTotal !== null && a.asrmTotal >= 6
                        ? "text-warning-fg"
                        : ""
                    }`}>
                      {a.asrmTotal ?? "—"}
                    </td>
                    <td className={`px-3 py-2 text-center font-medium ${
                      a.phq9Total !== null && a.phq9Total >= 15
                        ? "text-danger-fg"
                        : a.phq9Total !== null && a.phq9Total >= 10
                          ? "text-warning-fg"
                          : ""
                    }`}>
                      {a.phq9Total ?? "—"}
                    </td>
                    <td className={`px-3 py-2 text-center ${
                      a.phq9Item9 !== null && a.phq9Item9 >= 1
                        ? "font-bold text-danger-fg"
                        : ""
                    }`}>
                      {a.phq9Item9 ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {a.fastAvg !== null ? Number(a.fastAvg).toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted max-w-[200px] truncate">
                      {a.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            ASRM ≥6 = possível hipomania. PHQ-9: 5-9 leve, 10-14 moderado, 15-19 mod-severo, 20+ severo.
            Item 9 = ideação suicida (≥1 requer atenção imediata).
          </p>
        </Card>
      )}

      {/* Functioning Assessments */}
      {functioningAssessments.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-3">Funcionamento (FAST)</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-alt dark:bg-surface-raised">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted">Data</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Trabalho</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Social</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Autocuidado</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Finanças</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Cognição</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Lazer</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-muted">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {functioningAssessments.map((a) => (
                    <tr key={a.date} className="border-t border-border">
                      <td className="px-3 py-2 text-sm">
                        {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 text-center">{a.work ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{a.social ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{a.selfcare ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{a.finances ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{a.cognition ?? "—"}</td>
                      <td className="px-3 py-2 text-center">{a.leisure ?? "—"}</td>
                      <td className="px-3 py-2 text-center font-medium">
                        {a.avgScore !== null ? Number(a.avgScore).toFixed(1) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted">
              FAST: 1 = nenhuma dificuldade, 5 = dificuldade extrema. Menor = melhor funcionamento.
            </p>
          </Card>
        </>
      )}

      <p className="text-center text-[10px] text-muted py-4">
        Dados gerados automaticamente pelo Suporte Bipolar.
        Indicadores educacionais — uso clínico requer interpretação profissional.
      </p>
    </div>
  );
}
