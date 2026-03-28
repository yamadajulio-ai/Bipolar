"use client";

import { SLEEP_ROUTINES } from "@/lib/constants";

interface SleepRoutineChecklistProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function SleepRoutineChecklist({ selected, onChange }: SleepRoutineChecklistProps) {
  function handleToggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-2">
        Rotina pré-sono
      </label>
      <div className="space-y-2">
        {SLEEP_ROUTINES.map((routine) => (
          <label
            key={routine.key}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
              selected.includes(routine.key)
                ? routine.negative
                  ? "border-warning-border bg-warning-bg-subtle"
                  : "border-primary/50 bg-primary/10"
                : "border-border bg-surface hover:border-border/80"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(routine.key)}
              onChange={() => handleToggle(routine.key)}
              className="rounded border-control-border text-primary focus-visible:ring-control-border-focus"
            />
            <span className={routine.negative ? "text-foreground" : "text-foreground"}>
              {routine.label}
            </span>
            {routine.negative && (
              <span className="ml-auto text-xs text-warning-fg">negativo</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
