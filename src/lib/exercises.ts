import { BREATHING_EXERCISES, GROUNDING_EXERCISES } from "@/lib/constants";

export interface Exercise {
  id: string;
  type: "respiracao" | "aterramento";
  label: string;
  description: string;
  durationLabel: string;
  href: string;
}

function estimateBreathingDuration(config: {
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
  cycles: number;
}): string {
  const cycleTime = config.inhale + config.hold + config.exhale + config.holdAfter;
  const totalSecs = cycleTime * config.cycles;
  return `~${Math.ceil(totalSecs / 60)} min`;
}

function estimateGroundingDuration(
  steps: readonly Record<string, unknown>[],
): string {
  const totalSecs = steps.reduce(
    (sum, s) => sum + (typeof s.duration === "number" ? s.duration : 30),
    0,
  );
  return `~${Math.ceil(totalSecs / 60)} min`;
}

/** Unified exercise catalog built from constants */
export const EXERCISES: Exercise[] = [
  ...Object.entries(BREATHING_EXERCISES).map(([key, config]) => ({
    id: `respiracao_${key}`,
    type: "respiracao" as const,
    label: config.name,
    description: config.description,
    durationLabel: estimateBreathingDuration(config),
    href: `/exercicios/respiracao/${key}`,
  })),
  ...Object.entries(GROUNDING_EXERCISES).map(([key, config]) => ({
    id: `aterramento_${key}`,
    type: "aterramento" as const,
    label: config.name,
    description: config.description,
    durationLabel: estimateGroundingDuration(config.steps),
    href: `/exercicios/aterramento/${key}`,
  })),
];

export function getExercisesByType(type: "respiracao" | "aterramento"): Exercise[] {
  return EXERCISES.filter((e) => e.type === type);
}
