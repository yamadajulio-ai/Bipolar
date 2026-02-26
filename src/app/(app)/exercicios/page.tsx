import Link from "next/link";
import { Card } from "@/components/Card";
import { BREATHING_EXERCISES, GROUNDING_EXERCISES } from "@/lib/constants";

function estimateDuration(config: { inhale: number; hold: number; exhale: number; holdAfter: number; cycles: number }): string {
  const cycleTime = config.inhale + config.hold + config.exhale + config.holdAfter;
  const totalSecs = cycleTime * config.cycles;
  const minutes = Math.ceil(totalSecs / 60);
  return `~${minutes} min`;
}

function estimateGroundingDuration(steps: readonly Record<string, unknown>[]): string {
  const totalSecs = steps.reduce((sum, s) => sum + (typeof s.duration === "number" ? s.duration : 30), 0);
  const minutes = Math.ceil(totalSecs / 60);
  return `~${minutes} min`;
}

export default function ExerciciosPage() {
  const breathingEntries = Object.entries(BREATHING_EXERCISES) as [
    string,
    (typeof BREATHING_EXERCISES)[keyof typeof BREATHING_EXERCISES],
  ][];

  const groundingEntries = Object.entries(GROUNDING_EXERCISES) as [
    string,
    (typeof GROUNDING_EXERCISES)[keyof typeof GROUNDING_EXERCISES],
  ][];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Exercicios</h1>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Respiracao</h2>
        <div className="space-y-3">
          {breathingEntries.map(([key, config]) => (
            <Link key={key} href={`/exercicios/respiracao/${key}`} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{config.name}</p>
                    <p className="text-sm text-muted mt-1">{config.description}</p>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap ml-4">
                    {estimateDuration(config)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Aterramento</h2>
        <div className="space-y-3">
          {groundingEntries.map(([key, config]) => (
            <Link key={key} href={`/exercicios/aterramento/${key}`} className="block no-underline">
              <Card className="hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{config.name}</p>
                    <p className="text-sm text-muted mt-1">{config.description}</p>
                  </div>
                  <span className="text-xs text-muted whitespace-nowrap ml-4">
                    {estimateGroundingDuration(config.steps)}
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
