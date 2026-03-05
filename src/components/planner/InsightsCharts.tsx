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

function formatDatePtBR(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateWithWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function InsightsCharts({ data }: InsightsChartsProps) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickFormatter={formatDatePtBR}
          interval="preserveStartEnd"
        />
        <YAxis yAxisId="mood" domain={[1, 5]} tick={{ fontSize: 10 }} width={30} label={{ value: "Humor", angle: -90, position: "insideLeft", style: { fontSize: 9, fill: "#999" } }} />
        <YAxis yAxisId="sleep" orientation="right" domain={[0, 14]} tick={{ fontSize: 10 }} width={30} label={{ value: "Sono (h)", angle: 90, position: "insideRight", style: { fontSize: 9, fill: "#999" } }} />
        <Tooltip
          labelFormatter={(label) => formatDateWithWeekday(String(label))}
          formatter={(value: number | undefined, name: string | undefined) => {
            if (name === "Humor") return [`${value}/5`, "Humor"];
            if (name === "Sono") return [`${Number(value).toFixed(1)}h`, "Sono"];
            return [`${value}`, name];
          }}
        />
        <Legend />
        <Line yAxisId="mood" type="monotone" dataKey="mood" name="Humor" stroke="#6366f1" strokeWidth={2} dot={false} />
        <Line yAxisId="sleep" type="monotone" dataKey="sleepHours" name="Sono" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
