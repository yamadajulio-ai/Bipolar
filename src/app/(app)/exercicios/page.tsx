import Link from "next/link";
import { Card } from "@/components/Card";
import { AudioLibrary } from "@/components/AudioPlayer";
import { getExercisesByType } from "@/lib/exercises";

export default function ExerciciosPage() {
  const breathing = getExercisesByType("respiracao");
  const grounding = getExercisesByType("aterramento");

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Exercícios</h1>
      <p className="mb-6 text-sm text-muted">
        Técnicas guiadas para momentos de ansiedade, tensão ou dificuldade para dormir. Use quando precisar, sem pressa.
      </p>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Respiração</h2>
        <div className="space-y-3">
          {breathing.map((ex) => (
            <Link key={ex.id} href={ex.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{ex.label}</p>
                    <p className="text-sm text-muted mt-1">{ex.description}</p>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap ml-4">
                    {ex.durationLabel}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <AudioLibrary />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Aterramento</h2>
        <div className="space-y-3">
          {grounding.map((ex) => (
            <Link key={ex.id} href={ex.href} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{ex.label}</p>
                    <p className="text-sm text-muted mt-1">{ex.description}</p>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap ml-4">
                    {ex.durationLabel}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
