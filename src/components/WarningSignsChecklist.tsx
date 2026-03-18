"use client";

import { useState } from "react";
import { WARNING_SIGNS } from "@/lib/constants";

const INITIAL_VISIBLE = 6;

interface WarningSignsChecklistProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function WarningSignsChecklist({ selected, onChange }: WarningSignsChecklistProps) {
  const [expanded, setExpanded] = useState(false);

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else {
      onChange([...selected, key]);
    }
  }

  // Show all if expanded or if user already selected something beyond the initial set
  const hasSelectedBeyond = selected.some(
    (s) => WARNING_SIGNS.findIndex((ws) => ws.key === s) >= INITIAL_VISIBLE,
  );
  const showAll = expanded || hasSelectedBeyond;
  const visibleSigns = showAll ? WARNING_SIGNS : WARNING_SIGNS.slice(0, INITIAL_VISIBLE);
  const hiddenCount = WARNING_SIGNS.length - INITIAL_VISIBLE;

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-foreground mb-2">
        Sinais de alerta (opcional)
      </label>
      <p className="text-xs text-muted mb-3">
        Marque se notou algum sinal hoje. Isso ajuda a identificar padrões ao longo do tempo.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visibleSigns.map((sign) => (
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
      {!showAll && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Ver mais {hiddenCount} sinais
        </button>
      )}
    </div>
  );
}
