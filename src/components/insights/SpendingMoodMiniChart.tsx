"use client";

import { useState, useEffect } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SpendingMoodChartPoint } from "@/lib/insights/computeInsights";

interface Props {
  data: SpendingMoodChartPoint[];
}

function formatBRL(value: number): string {
  // Round to nearest 100 for privacy (P1: avoid exposing exact values in clinical context)
  const rounded = Math.round(value / 100) * 100;
  if (rounded >= 1000) return `R$${(rounded / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$${rounded}`;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: SpendingMoodChartPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  // Round expense for privacy
  const roundedExp = Math.round(point.expense / 10) * 10;
  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs text-foreground shadow-lg border border-border">
      <p className="font-medium">{point.date}</p>
      {point.expense > 0 && <p>Gastos: ~R${roundedExp.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</p>}
      {point.mood != null && <p>Humor: {point.mood}/5</p>}
      {point.spike && <p className="mt-1 font-semibold text-amber-300">Acima do seu padrão</p>}
    </div>
  );
}

/**
 * Custom bar shape with hatch pattern on spike days.
 * Uses diagonal lines (pattern fill) as non-color accessibility marker.
 */
function SpikeBar(props: { x?: number; y?: number; width?: number; height?: number; spike?: boolean; fill?: string; patternId: string }) {
  const { x = 0, y = 0, width = 0, height = 0, spike, fill, patternId } = props;
  if (height <= 0) return null;
  const r = Math.min(3, width / 2);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={spike ? `url(#${patternId})` : fill} rx={r} ry={r} />
      {spike && (
        <line
          x1={x} y1={y} x2={x + width} y2={y}
          stroke="#78350f" strokeWidth={2.5} strokeDasharray="3 2"
        />
      )}
    </g>
  );
}

// P0 contrast fixes: original colors vs AA-compliant replacements
// Bars normal: #64748b (slate-500, 4.6:1 on white) instead of #94a3b8 (2.56:1 FAIL)
// Bars spike: #b45309 (amber-700, 4.56:1 on white) instead of #d97706 (3.19:1)
// Mood line: #2563eb (blue-600, 4.68:1 on white) instead of #3b82f6 (3.68:1)
const COLOR_BAR = "#64748b";
const COLOR_SPIKE = "#b45309";
const COLOR_MOOD = "#2563eb";

export function SpendingMoodMiniChart({ data }: Props) {
  const maxExpense = Math.max(...data.map((d) => d.expense), 1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const patternId = "spike-hatch";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div>
      <p className="mb-2 text-[11px] text-foreground/60">
        <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ backgroundColor: COLOR_BAR }} />
        gastos
        <span className="mx-1.5">&middot;</span>
        <span className="inline-block w-3 h-0.5 mr-1 align-middle" style={{ backgroundColor: COLOR_MOOD }} />
        humor
        <span className="mx-1.5">&middot;</span>
        <span className="inline-block w-3 border-t-2 border-dashed align-middle" style={{ borderColor: "#78350f" }} />
        {" "}acima do padrão
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
          {/* SVG defs for hatch pattern on spike bars */}
          <defs>
            <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={COLOR_SPIKE} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#78350f" strokeWidth="1.5" />
            </pattern>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            yAxisId="expense"
            orientation="left"
            domain={[0, maxExpense * 1.2]}
            tickFormatter={formatBRL}
            tick={{ fontSize: 9, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            tickCount={3}
            width={42}
          />
          <YAxis
            yAxisId="mood"
            orientation="right"
            domain={[1, 5]}
            ticks={[1, 3, 5]}
            tick={{ fontSize: 9, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            width={18}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0,0,0,0.05)" }}
          />
          <Bar
            yAxisId="expense"
            dataKey="expense"
            maxBarSize={20}
            isAnimationActive={!reducedMotion}
            shape={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((props: any) => {
                const idx = props.index as number;
                const entry = data[idx];
                return (
                  <SpikeBar
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    spike={entry?.spike}
                    fill={COLOR_BAR}
                    patternId={patternId}
                  />
                );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any
            }
          />
          {/* Halo line: outline underneath for contrast over bars */}
          <Line
            yAxisId="mood"
            dataKey="mood"
            type="monotone"
            stroke="var(--halo-stroke, var(--background))"
            strokeWidth={5}
            dot={false}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
            legendType="none"
          />
          <Line
            yAxisId="mood"
            dataKey="mood"
            type="monotone"
            stroke={COLOR_MOOD}
            strokeWidth={2}
            dot={{ r: 3, fill: COLOR_MOOD, stroke: "var(--background)", strokeWidth: 1.5 }}
            connectNulls={false}
            isAnimationActive={!reducedMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
