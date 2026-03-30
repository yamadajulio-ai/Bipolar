"use client";

import type { StabilityScore } from "@/lib/insights/computeInsights";

const LEVEL_CONFIG = {
  muito_estavel: { color: "text-success-fg", bg: "bg-success-bg-subtle", ring: "stroke-success-fg" },
  estavel: { color: "text-success-fg", bg: "bg-success-bg-subtle", ring: "stroke-success-fg/80" },
  moderado: { color: "text-warning-fg", bg: "bg-warning-bg-subtle", ring: "stroke-warning-fg" },
  variavel: { color: "text-warning-fg", bg: "bg-warning-bg-subtle", ring: "stroke-warning-fg" },
  instavel: { color: "text-danger-fg", bg: "bg-danger-bg-subtle", ring: "stroke-danger-fg" },
} as const;

const COMPONENT_LABELS: Record<string, string> = {
  sleepRegularity: "Sono",
  medicationAdherence: "Medicação",
  moodStability: "Humor",
  instability: "Estabilidade",
};

function ScoreRing({ score, className }: { score: number; className: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" aria-hidden="true">
      <circle
        cx="44" cy="44" r={radius}
        fill="none"
        strokeWidth="6"
        className="stroke-border/30"
      />
      <circle
        cx="44" cy="44" r={radius}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        className={className}
      />
      <text
        x="44" y="40"
        textAnchor="middle"
        className="fill-foreground text-xl font-bold"
        style={{ fontSize: "22px", fontWeight: 700 }}
      >
        {score}
      </text>
      <text
        x="44" y="56"
        textAnchor="middle"
        className="fill-muted text-[11px]"
        style={{ fontSize: "10px" }}
      >
        de 100
      </text>
    </svg>
  );
}

function ComponentBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;

  let barColor = "bg-danger-fg";
  if (value >= 70) barColor = "bg-success-fg";
  else if (value >= 50) barColor = "bg-warning-fg";
  else if (value >= 30) barColor = "bg-warning-fg";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted w-16 shrink-0">{label}</span>
      <div
        className="flex-1 h-1.5 bg-border/30 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value} de 100`}
      >
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[11px] text-foreground/70 w-7 text-right" aria-hidden="true">{value}</span>
    </div>
  );
}

export function StabilityScoreWidget({ stability }: { stability: StabilityScore }) {
  const config = LEVEL_CONFIG[stability.level];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <ScoreRing score={stability.score} className={config.ring} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${config.color}`}>
              {stability.label}
            </span>
            {stability.provisional && (
              <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[11px] text-muted">
                provisório
              </span>
            )}
            {stability.riskCapped && (
              <span className="rounded-full bg-danger-bg-subtle px-1.5 py-0.5 text-[11px] text-danger-fg">
                limitado por risco
              </span>
            )}
          </div>

          {stability.deltaVsBaseline != null && stability.deltaVsBaseline !== 0 && (
            <p className={`text-[11px] ${stability.deltaVsBaseline > 0 ? "text-success-fg" : "text-danger-fg"}`}>
              {stability.deltaVsBaseline > 0 ? "+" : ""}{stability.deltaVsBaseline} vs. média anterior
            </p>
          )}

          <div className="space-y-1">
            {Object.entries(stability.components).map(([key, value]) => (
              <ComponentBar
                key={key}
                label={COMPONENT_LABELS[key] || key}
                value={value}
              />
            ))}
          </div>
        </div>
      </div>

      {stability.confidence !== "high" && (
        <p className="text-[11px] text-muted italic">
          {stability.confidence === "low"
            ? "Poucos dias de dados — o score vai ficar mais preciso com o tempo."
            : "Score baseado em dados parciais. Continue registrando para maior precisão."}
        </p>
      )}
    </div>
  );
}
