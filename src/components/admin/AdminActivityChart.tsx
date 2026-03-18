"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ date: string; checkins: number; sleep: number; exercises: number }>;
}

export function AdminActivityChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Sem dados para exibir.
      </p>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(8) + "/" + d.date.slice(5, 7),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted, #9ca3af)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted, #9ca3af)" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            type="monotone"
            dataKey="checkins"
            stroke="#527a6e"
            strokeWidth={2}
            dot={false}
            name="Check-ins"
          />
          <Line
            type="monotone"
            dataKey="sleep"
            stroke="#7da399"
            strokeWidth={2}
            dot={false}
            name="Sono"
          />
          <Line
            type="monotone"
            dataKey="exercises"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            name="Exercícios"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
