"use client";

import { useId, useState } from "react";
import type { MoodThermometer as MoodThermometerType } from "@/lib/insights/computeInsights";

/** Patient-facing props: raw scores (maniaScore/depressionScore) are omitted */
type ThermometerDisplayData = Omit<MoodThermometerType, "maniaScore" | "depressionScore">;

interface Props {
  data: ThermometerDisplayData;
}

const ZONE_COLORS: Record<string, { bg: string; text: string }> = {
  depressao: { bg: "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300" },
  depressao_leve: { bg: "bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800", text: "text-sky-700 dark:text-sky-300" },
  eutimia: { bg: "bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300" },
  hipomania: { bg: "bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300" },
  mania: { bg: "bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-300" },
};

const INSTABILITY_LABELS: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "text-emerald-600 dark:text-emerald-400" },
  moderada: { label: "Moderada", color: "text-amber-600 dark:text-amber-400" },
  alta: { label: "Alta", color: "text-red-600 dark:text-red-400" },
};

export function MoodThermometer({ data }: Props) {
  const colors = ZONE_COLORS[data.zone] || ZONE_COLORS.eutimia;
  const instab = INSTABILITY_LABELS[data.instability] || INSTABILITY_LABELS.baixa;
  const [showMixedInfo, setShowMixedInfo] = useState(false);
  const mixedId = useId();

  return (
    <div className={`rounded-[var(--radius-card)] p-5 ${colors.bg}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Termômetro de humor
        </h3>
        <span className="text-xs text-foreground/50">
          {data.daysUsed} dias
        </span>
      </div>

      {/* Zone label */}
      <div className="mb-4 text-center">
        <span className={`text-2xl font-bold ${colors.text}`}>
          {data.zoneLabel}
        </span>
        {data.mixedFeatures && (
          <button
            type="button"
            onClick={() => setShowMixedInfo(!showMixedInfo)}
            aria-expanded={showMixedInfo}
            aria-controls={mixedId}
            className="ml-2 rounded-full bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/60"
          >
            {data.mixedStrength === "forte" ? "Sinais mistos" : "Possíveis sinais mistos"} ⓘ
          </button>
        )}
      </div>

      {/* Mixed features explanation */}
      {data.mixedFeatures && showMixedInfo && (
        <div id={mixedId} className="mb-4 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 p-3 text-xs text-purple-800 dark:text-purple-200">
          {data.mixedStrength === "forte" ? (
            <>
              <strong>Sinais mistos detectados:</strong> indicadores de rebaixamento e ativação
              elevados simultaneamente. Quando humor e energia vão em direções opostas, pode ser difícil de identificar sozinho.
              Considere conversar com seu profissional.
            </>
          ) : (
            <>
              <strong>Possíveis sinais mistos:</strong> padrão recente sugere sobreposição de
              sinais de rebaixamento e ativação (ex: ansiedade alta com energia elevada ou sono
              reduzido). Se estiver difícil, considere buscar apoio profissional.
            </>
          )}
        </div>
      )}

      {/* Spectrum bar */}
      <div className="relative mb-2" aria-hidden="true">
        {/* Background gradient bar */}
        <div className="flex h-4 overflow-hidden rounded-full">
          <div className="flex-1 bg-blue-500" />
          <div className="flex-1 bg-sky-400" />
          <div className="flex-1 bg-emerald-400" />
          <div className="flex-1 bg-amber-400" />
          <div className="flex-1 bg-red-400" />
        </div>
        {/* Position indicator */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${data.position}%` }}
        >
          <div className="h-6 w-6 rounded-full border-[3px] border-white dark:border-surface bg-foreground shadow-[var(--shadow-float)]" />
        </div>
      </div>
      <div className="mb-4 flex justify-between text-[11px] text-foreground/50">
        <span>Rebaixamento</span>
        <span>Padrão</span>
        <span>Ativação</span>
      </div>

      {/* Stats row */}
      <div className="mb-3 grid grid-cols-1 gap-2 text-center">
        <div>
          <div className="text-xs text-foreground/60">Oscilação do humor</div>
          <div className={`text-sm font-semibold ${instab.color}`}>
            {instab.label}
          </div>
        </div>
      </div>

      {/* Contributing factors */}
      {data.factors.length > 0 && (
        <div className="rounded-lg bg-black/5 dark:bg-white/5 p-3">
          <div className="mb-1 text-xs font-medium text-foreground/60">
            Fatores recentes:
          </div>
          <div className="flex flex-wrap gap-1">
            {data.factors.map((f, i) => (
              <span
                key={`${f}-${i}`}
                className="rounded-full bg-white/70 dark:bg-white/10 border border-border px-2 py-0.5 text-xs text-foreground/80"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-foreground/50">
        Indicador baseado nos seus registros recentes. Não substitui avaliação profissional.
      </p>
      {!data.baselineAvailable && (
        <p className="mt-1 text-center text-[11px] text-amber-600 dark:text-amber-400">
          Usando referências gerais de sono. Com mais registros, o cálculo se ajustará ao seu padrão pessoal.
        </p>
      )}
    </div>
  );
}
