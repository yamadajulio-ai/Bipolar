"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
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
      {point.spike && <p className="mt-1 font-medium text-amber-400">Acima do seu padrão</p>}
    </div>
  );
}

export function SpendingMoodMiniChart({ data }: Props) {
  const maxExpense = Math.max(...data.map((d) => d.expense), 1);

  return (
    <div>
      <p className="mb-2 text-[10px] text-muted">
        barras = gastos &middot; linha = humor
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
          <ReferenceLine yAxisId="expense" y={0} stroke="transparent" />
          <Bar
            yAxisId="expense"
            dataKey="expense"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
            opacity={0.8}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.spike ? "#d97706" : "#94a3b8"}
              />
            ))}
          </Bar>
          <Line
            yAxisId="mood"
            dataKey="mood"
            type="monotone"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
