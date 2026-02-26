"use client";

interface ProgressStepsProps {
  current: number;
  total: number;
}

export function ProgressSteps({ current, total }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
            i < current
              ? "bg-primary text-white"
              : i === current
                ? "bg-primary/20 border-2 border-primary text-primary"
                : "bg-surface-alt border border-border text-muted"
          }`}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}
