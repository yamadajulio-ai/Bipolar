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

interface Entry {
  date: string;
  mood: number;
  sleepHours: number;
}

interface MoodSleepChartProps {
  entries: Entry[];
}

export function MoodSleepChart({ entries }: MoodSleepChartProps) {
  const data = entries.map((e) => ({
    date: e.date.slice(5).split("-").reverse().join("/"),
    humor: e.mood,
    sono: e.sleepHours,
  }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Registre humor e sono para visualizar a relação entre eles aqui.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "var(--color-muted, #9ca3af)" }}
        />
        <YAxis
          yAxisId="mood"
          domain={[1, 5]}
          tick={{ fontSize: 12, fill: "var(--color-muted, #9ca3af)" }}
          label={{
            value: "Humor",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "var(--color-primary, #527a6e)" },
          }}
        />
        <YAxis
          yAxisId="sleep"
          orientation="right"
          domain={[0, 12]}
          tick={{ fontSize: 12, fill: "var(--color-muted, #9ca3af)" }}
          label={{
            value: "Sono (h)",
            angle: 90,
            position: "insideRight",
            style: { fontSize: 12, fill: "var(--color-primary-light, #7da399)" },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface, #fff)",
            border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Line
          yAxisId="mood"
          type="monotone"
          dataKey="humor"
          stroke="var(--color-primary, #527a6e)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary, #527a6e)" }}
          name="Humor"
        />
        <Line
          yAxisId="sleep"
          type="monotone"
          dataKey="sono"
          stroke="var(--color-primary-light, #7da399)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary-light, #7da399)" }}
          name="Sono (h)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
