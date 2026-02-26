import { Alert } from "@/components/Alert";

interface ContextualSuggestionsProps {
  hasTodayEntry: boolean;
  hasTodaySleep: boolean;
  daysSinceLastEntry: number | null;
  recentAlerts: string[];
}

export function ContextualSuggestions({
  hasTodayEntry,
  hasTodaySleep,
  daysSinceLastEntry,
  recentAlerts,
}: ContextualSuggestionsProps) {
  const suggestions: Array<{ text: string; variant: "info" | "warning" }> = [];

  if (!hasTodayEntry) {
    suggestions.push({
      text: "Que tal registrar como você está hoje? O diário ajuda a identificar padrões.",
      variant: "info",
    });
  }

  if (!hasTodaySleep) {
    suggestions.push({
      text: "Registre como dormiu na noite passada. O sono é fundamental para estabilidade.",
      variant: "info",
    });
  }

  if (daysSinceLastEntry !== null && daysSinceLastEntry >= 3) {
    suggestions.push({
      text: `Faz ${daysSinceLastEntry} dias sem registro no diário. Manter a regularidade ajuda você e seu profissional.`,
      variant: "warning",
    });
  }

  for (const alert of recentAlerts) {
    suggestions.push({ text: alert, variant: "warning" });
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2">
      {suggestions.map((s, i) => (
        <Alert key={i} variant={s.variant}>
          {s.text}
        </Alert>
      ))}
    </div>
  );
}
