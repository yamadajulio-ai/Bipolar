"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface InsightsChartsProps {
  data: {
    date: string;
    mood: number;
    sleepHours: number;
    energy: number | null;
  }[];
}

export function InsightsCharts({ data }: InsightsChartsProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(5)} // MM-DD
        />
        <YAxis yAxisId="mood" domain={[1, 5]} tick={{ fontSize: 10 }} width={30} />
        <YAxis yAxisId="sleep" orientation="right" domain={[0, 14]} tick={{ fontSize: 10 }} width={30} />
        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) =>
            [name === "Humor" ? `${value}/5` : `${value}h`, name]
          }
        />
        <Legend />
        <Line yAxisId="mood" type="monotone" dataKey="mood" name="Humor" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line yAxisId="sleep" type="monotone" dataKey="sleepHours" name="Sono" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
