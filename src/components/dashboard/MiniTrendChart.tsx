"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface MiniTrendChartProps {
  data: Array<{ date: string; mood: number; sleepHours: number | null }>;
}

export function MiniTrendChart({ data }: MiniTrendChartProps) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted text-center py-4">
        Dados insuficientes para gráfico. Registre pelo menos 2 dias.
      </p>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(8) + "/" + d.date.slice(5, 7),
  }));

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="mood" domain={[1, 5]} tick={{ fontSize: 10 }} width={25} />
          <YAxis yAxisId="sleep" orientation="right" domain={[0, 14]} tick={{ fontSize: 10 }} width={25} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              backgroundColor: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
            }}
            formatter={(value, name) => {
              const v = value as number | null;
              return [name === "mood" ? `${v}/5` : v != null ? `${v}h` : "—", name === "mood" ? "Humor" : "Sono"];
            }}
          />
          <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="var(--color-primary, #527a6e)" strokeWidth={2} dot={false} />
          <Line yAxisId="sleep" type="monotone" dataKey="sleepHours" stroke="var(--color-primary-light, #7da399)" strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
