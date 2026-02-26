"use client";

import clsx from "clsx";

interface PeriodSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

const periods = [
  { days: 7, label: "7 dias" },
  { days: 14, label: "14 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-2">
      {periods.map((p) => (
        <button
          key={p.days}
          type="button"
          onClick={() => onChange(p.days)}
          className={clsx(
            "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
            value === p.days
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-muted hover:border-primary/50"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
