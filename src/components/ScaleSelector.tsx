"use client";

import clsx from "clsx";
import { useId } from "react";

interface ScaleSelectorProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  labels: Record<number, string>;
  required?: boolean;
}

export function ScaleSelector({ label, value, onChange, labels, required }: ScaleSelectorProps) {
  const groupId = useId();

  return (
    <div className="mb-4" role="group" aria-labelledby={groupId}>
      <label id={groupId} className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            aria-label={`${label}: ${labels[n]} (${n} de 5)`}
            className={clsx(
              "flex-1 rounded-[var(--radius-card)] border px-2 py-2 text-xs font-medium transition-colors min-h-[44px]",
              value === n
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-foreground/70 hover:border-primary/50"
            )}
          >
            {labels[n]}
          </button>
        ))}
      </div>
    </div>
  );
}
