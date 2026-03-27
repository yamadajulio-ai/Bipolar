"use client";

import type { CyclingAnalysis as CyclingAnalysisType } from "@/lib/insights/computeInsights";

interface Props {
  data: CyclingAnalysisType;
}

const EPISODE_COLORS: Record<string, string> = {
  mania: "bg-amber-400 text-amber-900",
  depression: "bg-blue-300 text-blue-900",
  mixed: "bg-purple-300 text-purple-900",
};

export function CyclingAnalysis({ data }: Props) {
  if (data.episodes.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] bg-surface border border-border-soft dark:border-border-strong p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Análise de Ciclagem
        </h3>
        {data.isRapidCycling && (
          <span className="rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Possível ciclagem rápida
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-foreground/60">Episódios</div>
          <div className="text-lg font-bold text-foreground">{data.episodes.length}</div>
          <div className="text-[11px] text-foreground/50">últimos 90 dias</div>
        </div>
        <div>
          <div className="text-xs text-foreground/60">Mudanças de polo</div>
          <div className="text-lg font-bold text-foreground">{data.polaritySwitches}</div>
        </div>
        <div>
          <div className="text-xs text-foreground/60">Ciclo médio</div>
          <div className="text-lg font-bold text-foreground">
            {data.avgCycleLength !== null ? `${data.avgCycleLength}d` : "—"}
          </div>
        </div>
      </div>

      {/* Episode timeline */}
      <div className="mb-3">
        <p className="mb-1.5 text-[11px] font-medium text-foreground/60">Linha do tempo</p>
        <div className="flex flex-wrap gap-1">
          {data.episodes.map((ep, i) => {
            const start = new Date(ep.startDate + "T12:00:00");
            const end = new Date(ep.endDate + "T12:00:00");
            const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
            const label = ep.type === "mania" ? "M" : ep.type === "depression" ? "D" : "X";
            const typeLabel = ep.type === "mania" ? "Mania" : ep.type === "depression" ? "Depressão" : "Misto";

            return (
              <div
                key={i}
                className={`rounded-md ${EPISODE_COLORS[ep.type]} px-2 py-1 text-[11px] font-semibold`}
                aria-label={`${typeLabel}: ${ep.startDate} a ${ep.endDate} (${days} dias)`}
                title={`${typeLabel}: ${ep.startDate} a ${ep.endDate} (${days} dias)`}
              >
                {label} {days}d
              </div>
            );
          })}
        </div>
      </div>

      {data.isRapidCycling && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          O padrão de episódios sugere possível ciclagem rápida (≥4 episódios/ano).
          Esse pode ser um tema para discutir com seu psiquiatra na próxima consulta.
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-foreground/50">
        Detecção baseada em padrões de humor e energia. Não constitui diagnóstico.
        Ciclagem rápida = 4 ou mais episódios em um ano (critério diagnóstico internacional).
      </p>
    </div>
  );
}
