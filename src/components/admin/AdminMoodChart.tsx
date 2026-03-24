"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ date: string; avg: number }>;
}

export function AdminMoodChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.date.slice(8) + "/" + d.date.slice(5, 7),
  }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--color-muted, #9ca3af)" }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[1, 5]}
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
            formatter={(value: number | undefined) => [`${value ?? 0}/5`, "Humor médio"]}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke="var(--color-primary, #527a6e)"
            strokeWidth={2}
            dot={{ r: 2, fill: "var(--color-primary, #527a6e)" }}
            name="Humor médio"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
