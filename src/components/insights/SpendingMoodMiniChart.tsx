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
  Cell,
} from "recharts";
import type { SpendingMoodChartPoint } from "@/lib/insights/computeInsights";

interface Props {
  data: SpendingMoodChartPoint[];
}

function formatBRL(value: number): string {
  if (value >= 1000) return `R$${(value / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$${Math.round(value)}`;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: SpendingMoodChartPoint;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-medium">{point.date}</p>
      {point.expense > 0 && <p>Gastos: R${point.expense.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</p>}
      {point.mood != null && <p>Humor: {point.mood}/5</p>}
      {point.spike && <p className="mt-1 font-medium text-amber-400">⚠ Acima do seu padrão</p>}
    </div>
  );
}

/** Custom bar shape: adds a dashed top border on spike days for non-color accessibility */
function SpikeBar(props: { x?: number; y?: number; width?: number; height?: number; spike?: boolean; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, spike, fill } = props;
  if (height <= 0) return null;
  const r = Math.min(3, width / 2);
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={r} ry={r} />
      {spike && (
        <line
          x1={x} y1={y} x2={x + width} y2={y}
          stroke="#92400e" strokeWidth={2.5} strokeDasharray="3 2"
        />
      )}
    </g>
  );
}

export function SpendingMoodMiniChart({ data }: Props) {
  const maxExpense = Math.max(...data.map((d) => d.expense), 1);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div>
      <p className="mb-2 text-[10px] text-muted">
        barras = gastos &middot; linha = humor &middot;
        <span className="inline-block ml-1 w-3 border-t-2 border-dashed border-amber-700 align-middle" /> = acima do padrão
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="expense"
            orientation="left"
            domain={[0, maxExpense * 1.2]}
            tickFormatter={formatBRL}
            tick={{ fontSize: 9, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <YAxis
            yAxisId="mood"
            orientation="right"
            domain={[1, 5]}
            ticks={[1, 3, 5]}
            tick={{ fontSize: 9, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            width={20}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            yAxisId="expense"
            dataKey="expense"
            maxBarSize={24}
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
                    fill={entry?.spike ? "#d97706" : "#94a3b8"}
                  />
                );
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any
            }
          />
          <Line
            yAxisId="mood"
            dataKey="mood"
            type="monotone"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            connectNulls
            isAnimationActive={!reducedMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
