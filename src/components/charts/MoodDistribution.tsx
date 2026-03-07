"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { MOOD_LABELS } from "@/lib/constants";

interface MoodDistributionProps {
  entries: { mood: number }[];
}

const moodColors: Record<number, string> = {
  1: "#ef4444", // danger red
  2: "#f59e0b", // warning amber
  3: "#9ca3af", // muted gray
  4: "#3b82f6", // info blue
  5: "#527a6e", // primary teal
};

export function MoodDistribution({ entries }: MoodDistributionProps) {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const e of entries) {
    counts[e.mood] = (counts[e.mood] || 0) + 1;
  }

  const data = [1, 2, 3, 4, 5].map((n) => ({
    name: MOOD_LABELS[n],
    quantidade: counts[n],
    level: n,
  }));

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Sem dados para exibir neste período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--color-muted, #9ca3af)" }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "var(--color-muted, #9ca3af)" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface, #fff)",
            border: "1px solid var(--color-border, #e5e7eb)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey="quantidade" name="Registros" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.level} fill={moodColors[entry.level]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
