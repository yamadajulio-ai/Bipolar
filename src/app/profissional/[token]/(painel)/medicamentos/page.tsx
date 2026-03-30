import { prisma } from "@/lib/db";
import { getProfessionalSession } from "@/lib/professionalSession";
import { redirect } from "next/navigation";
import { Card } from "@/components/Card";

export default async function ViewerMedicamentosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getProfessionalSession(token);
  if (!session) redirect(`/profissional/${token}`);

  const medications = await prisma.medication.findMany({
    where: { userId: session.patientUserId, isActive: true },
    include: {
      schedules: {
        where: { effectiveTo: null },
        orderBy: { timeLocal: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const inactiveMedications = await prisma.medication.findMany({
    where: { userId: session.patientUserId, isActive: false },
    orderBy: { name: "asc" },
    take: 20,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Medicamentos</h1>
        <p className="text-sm text-muted mt-1">Medicamentos de {session.patientName}</p>
      </div>

      {medications.length === 0 ? (
        <Card>
          <p className="text-center text-muted">Nenhum medicamento ativo cadastrado.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <Card key={med.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{med.name}</p>
                  {med.dosageText && (
                    <p className="text-sm text-muted mt-0.5">{med.dosageText}</p>
                  )}
                  {med.riskRole && (
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      med.riskRole === "MOOD_STABILIZER" ? "bg-primary/10 text-primary" :
                      med.riskRole === "ANTIPSYCHOTIC" ? "bg-info-bg-subtle text-info-fg" :
                      med.riskRole === "ANTIDEPRESSANT" ? "bg-success-bg-subtle text-success-fg" :
                      "bg-surface-alt text-muted"
                    }`}>
                      {med.riskRole === "MOOD_STABILIZER" ? "Estabilizador" :
                       med.riskRole === "ANTIPSYCHOTIC" ? "Antipsicótico" :
                       med.riskRole === "ANTIDEPRESSANT" ? "Antidepressivo" :
                       med.riskRole === "ANXIOLYTIC" ? "Ansiolítico" :
                       med.riskRole === "SLEEP_AID" ? "Indutor de sono" :
                       med.riskRole}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {med.isAsNeeded ? (
                    <span className="text-xs text-muted">Se necessário</span>
                  ) : med.schedules.length > 0 ? (
                    <div className="space-y-0.5">
                      {med.schedules.map((s) => (
                        <p key={s.id} className="text-xs text-muted">{s.timeLocal}</p>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">Sem horários</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {inactiveMedications.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-8 mb-3 text-muted">Inativos</h2>
          <div className="space-y-2">
            {inactiveMedications.map((med) => (
              <Card key={med.id} className="opacity-60">
                <p className="font-medium text-foreground">{med.name}</p>
                {med.dosageText && <p className="text-sm text-muted">{med.dosageText}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
