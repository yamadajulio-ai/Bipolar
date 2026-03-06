"use client";

import type { CyclingAnalysis as CyclingAnalysisType } from "@/lib/insights/computeInsights";

interface Props {
  data: CyclingAnalysisType;
}

const EPISODE_COLORS: Record<string, string> = {
  mania: "bg-amber-500",
  depression: "bg-blue-500",
  mixed: "bg-purple-500",
};

export function CyclingAnalysis({ data }: Props) {
  if (data.episodes.length === 0) return null;

  return (
    <div className="rounded-xl bg-gray-900/50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Análise de Ciclagem
        </h3>
        {data.isRapidCycling && (
          <span className="rounded-full bg-red-900/50 px-2.5 py-0.5 text-xs font-medium text-red-300">
            Possível ciclagem rápida
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs text-muted">Episódios</div>
          <div className="text-lg font-bold text-foreground">{data.episodes.length}</div>
          <div className="text-[10px] text-muted">últimos 90 dias</div>
        </div>
        <div>
          <div className="text-xs text-muted">Mudanças de polo</div>
          <div className="text-lg font-bold text-foreground">{data.polaritySwitches}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Ciclo médio</div>
          <div className="text-lg font-bold text-foreground">
            {data.avgCycleLength !== null ? `${data.avgCycleLength}d` : "—"}
          </div>
        </div>
      </div>

      {/* Episode timeline */}
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-medium text-muted">Linha do tempo</p>
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
                className={`rounded-md ${EPISODE_COLORS[ep.type]} px-2 py-1 text-[10px] font-medium text-white`}
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
        <div className="rounded-lg bg-red-900/20 p-3 text-xs text-red-200">
          O padrão de episódios sugere possível ciclagem rápida (≥4 episódios/ano).
          Esse pode ser um tema para discutir com seu psiquiatra na próxima consulta.
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-muted">
        Detecção baseada em padrões de humor e energia. Não constitui diagnóstico.
        Referência: DSM-5 (ciclagem rápida = ≥4 episódios/ano).
      </p>
    </div>
  );
}
