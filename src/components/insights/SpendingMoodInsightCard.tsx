"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Card } from "@/components/Card";
import type { SpendingMoodInsight } from "@/lib/insights/computeInsights";

const SpendingMoodMiniChart = dynamic(
  () => import("./SpendingMoodMiniChart").then((m) => m.SpendingMoodMiniChart),
  { ssr: false, loading: () => <div className="h-[180px] animate-pulse rounded-lg bg-surface-alt" /> },
);

interface Props {
  data: SpendingMoodInsight;
}

const STATE_BADGES: Record<string, { label: string; className: string }> = {
  learning: { label: "Coletando dados", className: "bg-gray-100 text-gray-700 border border-gray-200" },
  noSignal: { label: "Sem sinal claro", className: "bg-gray-100 text-gray-700 border border-gray-200" },
  watch: { label: "Vale observar", className: "bg-amber-100 text-amber-800 border border-amber-200" },
  strong: { label: "Acompanhar de perto", className: "bg-amber-200 text-amber-900 border border-amber-300" },
};

export function SpendingMoodInsightCard({ data }: Props) {
  if (data.state === "hidden") return null;

  const badge = STATE_BADGES[data.state];
  const showChart = data.state === "watch" || data.state === "strong";

  const chartDescId = "spending-mood-sr-desc";

  return (
    <Card>
      {/* Screen reader summary — programmatically associated with chart figure */}
      {data.srSummary && <p id={chartDescId} className="sr-only">{data.srSummary}</p>}

      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-base font-semibold">Humor e gastos</h2>
        {badge && (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Summary text */}
      <p className="text-sm text-foreground/80 leading-relaxed">{data.summary}</p>

      {/* Chart (only for watch/strong with data) — wrapped in figure for SR association */}
      {showChart && data.chartData && data.chartData.some((d) => d.expense > 0) && (
        <figure className="mt-3" role="img" aria-describedby={data.srSummary ? chartDescId : undefined}>
          {data.chartRangeLabel && (
            <figcaption className="mb-1 text-[10px] font-medium text-muted">{data.chartRangeLabel}</figcaption>
          )}
          <SpendingMoodMiniChart data={data.chartData} />
        </figure>
      )}

      {/* Chips */}
      {data.chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {data.chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-surface-alt px-2.5 py-1 text-[11px] text-foreground/70"
            >
              <span className="mr-1" aria-hidden="true">&bull;</span>
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Helper text */}
      {data.helper && (
        <p className="mt-2 text-xs text-foreground/60">{data.helper}</p>
      )}

      {/* CTA */}
      <Link
        href={data.ctaHref}
        className="mt-3 block text-center text-xs font-medium text-primary no-underline hover:text-primary/80 transition-colors"
      >
        Abrir análise financeira completa &rsaquo;
      </Link>
    </Card>
  );
}
