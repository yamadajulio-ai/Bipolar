import { WeeklyView } from "@/components/planner/WeeklyView";
import { localDateStr } from "@/lib/dateUtils";

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

export default function PlanejadorPage() {
  const mondayStr = getMonday();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Planejador Semanal</h1>
      <p className="mb-6 text-sm text-muted">
        Organize sua semana com blocos de atividades. Ancoras protegem sua estabilidade.
      </p>
      <WeeklyView initialWeekStart={mondayStr} />
    </div>
  );
}
