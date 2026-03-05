"use client";

import { useState } from "react";
import type { MoodThermometer as MoodThermometerType } from "@/lib/insights/computeInsights";

/** Patient-facing props: raw scores (maniaScore/depressionScore) are omitted */
type ThermometerDisplayData = Omit<MoodThermometerType, "maniaScore" | "depressionScore">;

interface Props {
  data: ThermometerDisplayData;
}

const ZONE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  depressao: { bg: "bg-blue-900/30", text: "text-blue-300", bar: "bg-blue-500" },
  depressao_leve: { bg: "bg-blue-800/20", text: "text-blue-200", bar: "bg-blue-400" },
  eutimia: { bg: "bg-green-900/30", text: "text-green-300", bar: "bg-green-500" },
  hipomania: { bg: "bg-amber-900/30", text: "text-amber-300", bar: "bg-amber-500" },
  mania: { bg: "bg-red-900/30", text: "text-red-300", bar: "bg-red-500" },
};

const INSTABILITY_LABELS: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "text-green-400" },
  moderada: { label: "Moderada", color: "text-amber-400" },
  alta: { label: "Alta", color: "text-red-400" },
};

export function MoodThermometer({ data }: Props) {
  const colors = ZONE_COLORS[data.zone] || ZONE_COLORS.eutimia;
  const instab = INSTABILITY_LABELS[data.instability] || INSTABILITY_LABELS.baixa;
  const [showMixedInfo, setShowMixedInfo] = useState(false);

  return (
    <div className={`rounded-xl p-5 ${colors.bg}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Termômetro de humor
        </h3>
        <span className="text-xs text-muted">
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
            onClick={() => setShowMixedInfo(!showMixedInfo)}
            className="ml-2 rounded-full bg-purple-800/50 px-2 py-0.5 text-xs text-purple-300 hover:bg-purple-800/70"
          >
            Sinais mistos ⓘ
          </button>
        )}
      </div>

      {/* Mixed features explanation */}
      {data.mixedFeatures && showMixedInfo && (
        <div className="mb-4 rounded-lg bg-purple-900/30 p-3 text-xs text-purple-200">
          Sinais mistos = alguns sinais de rebaixamento e de ativação ao mesmo
          tempo. Isso pode indicar instabilidade. Se estiver difícil, considere
          buscar apoio profissional.
        </div>
      )}

      {/* Spectrum bar */}
      <div className="relative mb-2">
        {/* Background gradient bar */}
        <div className="flex h-4 overflow-hidden rounded-full">
          <div className="flex-1 bg-blue-600" />
          <div className="flex-1 bg-blue-400" />
          <div className="flex-1 bg-green-500" />
          <div className="flex-1 bg-amber-400" />
          <div className="flex-1 bg-red-500" />
        </div>
        {/* Position indicator */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${data.position}%` }}
        >
          <div className="h-6 w-6 rounded-full border-3 border-white bg-gray-900 shadow-lg" />
        </div>
      </div>
      <div className="mb-4 flex justify-between text-[10px] text-muted">
        <span>Rebaixamento</span>
        <span>Padrão</span>
        <span>Ativação</span>
      </div>

      {/* Stats row */}
      <div className="mb-3 grid grid-cols-1 gap-2 text-center">
        <div>
          <div className="text-xs text-muted">Oscilação do humor</div>
          <div className={`text-sm font-semibold ${instab.color}`}>
            {instab.label}
          </div>
        </div>
      </div>

      {/* Contributing factors */}
      {data.factors.length > 0 && (
        <div className="rounded-lg bg-black/20 p-3">
          <div className="mb-1 text-xs font-medium text-muted">
            Fatores recentes:
          </div>
          <div className="flex flex-wrap gap-1">
            {data.factors.map((f) => (
              <span
                key={f}
                className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-gray-300"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-[10px] text-muted">
        Indicador baseado nos seus registros recentes. Não substitui avaliação profissional.
      </p>
      {!data.baselineAvailable && (
        <p className="mt-1 text-center text-[10px] text-amber-400/80">
          Usando referências gerais de sono. Com mais registros, o cálculo se ajustará ao seu padrão pessoal.
        </p>
      )}
    </div>
  );
}
