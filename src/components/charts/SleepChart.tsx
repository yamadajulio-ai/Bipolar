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

interface SleepDataPoint {
  date: string;
  totalHours: number;
  quality: number;
}

interface SleepChartProps {
  data: SleepDataPoint[];
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

export function SleepChart({ data }: SleepChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
  }));

  if (chartData.length === 0) {
    return (
      <p className="text-center text-muted py-8">
        Sem dados suficientes para gerar o gráfico.
      </p>
    );
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="hours"
            domain={[0, 14]}
            tick={{ fontSize: 12 }}
            label={{ value: "Horas", angle: -90, position: "insideLeft", fontSize: 12 }}
          />
          <YAxis
            yAxisId="quality"
            orientation="right"
            domain={[1, 5]}
            tick={{ fontSize: 12 }}
            label={{ value: "Qualidade", angle: 90, position: "insideRight", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined, name: string | undefined) => {
              if (name === "Horas de sono") return [`${value}h`, name];
              return [value, name];
            }}
          />
          <Legend />
          <Line
            yAxisId="hours"
            type="monotone"
            dataKey="totalHours"
            name="Horas de sono"
            stroke="var(--color-primary, #527a6e)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            yAxisId="quality"
            type="monotone"
            dataKey="quality"
            name="Qualidade"
            stroke="var(--color-success, #22c55e)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
