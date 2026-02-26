"use client";

import { WARNING_SIGNS } from "@/lib/constants";

interface WarningSignsChecklistProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function WarningSignsChecklist({ selected, onChange }: WarningSignsChecklistProps) {
  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-2">
        Sinais de alerta (opcional)
      </label>
      <p className="text-xs text-muted mb-3">
        Marque se notou algum sinal hoje. Isso ajuda a identificar padrões ao longo do tempo.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {WARNING_SIGNS.map((sign) => (
          <label
            key={sign.key}
            className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm cursor-pointer hover:bg-surface-alt transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(sign.key)}
              onChange={() => toggle(sign.key)}
              className="accent-primary"
            />
            <span className="text-foreground">{sign.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
