"use client";

import { useId, useState } from "react";
import type { EpisodePrediction as EpisodePredictionType } from "@/lib/insights/computeInsights";

interface Props {
  data: EpisodePredictionType;
}

const LEVEL_CONFIG = {
  baixo: { bg: "bg-emerald-50 border border-emerald-200", badge: "bg-emerald-100 text-emerald-700", label: "Risco baixo" },
  moderado: { bg: "bg-amber-50 border border-amber-200", badge: "bg-amber-100 text-amber-700", label: "Risco moderado" },
  elevado: { bg: "bg-red-50 border border-red-200", badge: "bg-red-100 text-red-700", label: "Risco elevado" },
};

export function EpisodePrediction({ data }: Props) {
  const config = LEVEL_CONFIG[data.level];
  const [expanded, setExpanded] = useState(data.level === "elevado");
  const panelId = useId();

  // Defensive clamp to prevent CSS overflow
  const maniaRisk = Math.max(0, Math.min(100, data.maniaRisk));
  const depressionRisk = Math.max(0, Math.min(100, data.depressionRisk));

  return (
    <div className={`rounded-[var(--radius-card)] p-5 ${config.bg}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Predição de Episódio
        </h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
          {config.label}
        </span>
      </div>

      {/* Dual risk bars */}
      <div className="mb-4 space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-amber-700">Ativação</span>
            <span className="tabular-nums text-foreground/60">{maniaRisk}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/10">
            <div
              className="h-2.5 rounded-full bg-amber-400 transition-all"
              style={{ width: `${maniaRisk}%` }}
            />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-blue-700">Rebaixamento</span>
            <span className="tabular-nums text-foreground/60">{depressionRisk}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-black/10">
            <div
              className="h-2.5 rounded-full bg-blue-400 transition-all"
              style={{ width: `${depressionRisk}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expandable signals */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="mb-2 text-xs font-medium text-primary hover:text-primary-dark"
      >
        {expanded ? "Ocultar sinais ▲" : "Ver sinais ▼"}
      </button>

      {expanded && (
        <div id={panelId} className="mb-3 space-y-2">
          {data.maniaSignals.length > 0 && (
            <div className="rounded-lg bg-amber-100/60 border border-amber-200/50 p-2.5">
              <p className="mb-1 text-[10px] font-semibold text-amber-700">Sinais de ativação</p>
              <ul className="space-y-0.5">
                {data.maniaSignals.map((s, i) => (
                  <li key={i} className="text-xs text-foreground/70">• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {data.depressionSignals.length > 0 && (
            <div className="rounded-lg bg-blue-100/60 border border-blue-200/50 p-2.5">
              <p className="mb-1 text-[10px] font-semibold text-blue-700">Sinais de rebaixamento</p>
              <ul className="space-y-0.5">
                {data.depressionSignals.map((s, i) => (
                  <li key={i} className="text-xs text-foreground/70">• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <div className="rounded-lg bg-surface/60 border border-border p-2.5">
          <p className="mb-1 text-[10px] font-semibold text-foreground/60">Recomendações</p>
          <ul className="space-y-0.5">
            {data.recommendations.map((r, i) => (
              <li key={i} className="text-xs text-foreground/70">→ {r}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-foreground/50">
        Baseado em sinais que costumam aparecer antes de episódios. Indicador educacional — não substitui avaliação profissional.
        {data.daysUsed} dias analisados.
      </p>
    </div>
  );
}
