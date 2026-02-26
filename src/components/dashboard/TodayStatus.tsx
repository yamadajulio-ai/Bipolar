import { Card } from "@/components/Card";
import { MOOD_LABELS } from "@/lib/constants";

interface TodayStatusProps {
  todayEntry: {
    mood: number;
    sleepHours: number;
    energyLevel?: number | null;
  } | null;
}

export function TodayStatus({ todayEntry }: TodayStatusProps) {
  if (!todayEntry) {
    return (
      <Card className="border-l-4 border-l-warning">
        <p className="font-medium text-foreground">Hoje</p>
        <p className="text-sm text-muted mt-1">
          Você ainda não registrou o dia de hoje.
        </p>
        <a
          href="/diario/novo"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Registrar agora
        </a>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-success">
      <p className="font-medium text-foreground">Hoje</p>
      <div className="mt-2 flex gap-4 text-sm">
        <div>
          <span className="text-muted">Humor: </span>
          <span className="font-medium">{MOOD_LABELS[todayEntry.mood]}</span>
        </div>
        <div>
          <span className="text-muted">Sono: </span>
          <span className="font-medium">{todayEntry.sleepHours}h</span>
        </div>
        {todayEntry.energyLevel && (
          <div>
            <span className="text-muted">Energia: </span>
            <span className="font-medium">{todayEntry.energyLevel}/5</span>
          </div>
        )}
      </div>
    </Card>
  );
}
