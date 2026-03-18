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

interface RhythmEntry {
  date: string;
  wakeTime?: string | null;
  firstContact?: string | null;
  mainActivityStart?: string | null;
  dinnerTime?: string | null;
  bedtime?: string | null;
}

interface RhythmChartProps {
  entries: RhythmEntry[];
}

function timeToDecimal(time: string | null | undefined): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function formatHour(value: number): string {
  const h = Math.floor(value);
  const m = Math.round((value - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const anchorConfig = [
  { key: "wakeTime", label: "Acordou", color: "#f59e0b" },
  { key: "firstContact", label: "1o contato social", color: "#3b82f6" },
  { key: "mainActivityStart", label: "Ativ. principal", color: "#10b981" },
  { key: "dinnerTime", label: "Jantar", color: "#8b5cf6" },
  { key: "bedtime", label: "Dormir", color: "#ef4444" },
];

export function RhythmChart({ entries }: RhythmChartProps) {
  const data = entries.map((entry) => ({
    date: formatDate(entry.date),
    wakeTime: timeToDecimal(entry.wakeTime),
    firstContact: timeToDecimal(entry.firstContact),
    mainActivityStart: timeToDecimal(entry.mainActivityStart),
    dinnerTime: timeToDecimal(entry.dinnerTime),
    bedtime: timeToDecimal(entry.bedtime),
  }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        Sem dados suficientes para gerar o gráfico.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis
          domain={[0, 24]}
          reversed
          tickFormatter={formatHour}
          tick={{ fontSize: 11 }}
          label={{
            value: "Hora do dia",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12 },
          }}
        />
        <Tooltip
          formatter={(value: number | undefined) => value != null ? formatHour(value) : ""}
          labelFormatter={(label: unknown) => `Data: ${label}`}
        />
        <Legend />
        {anchorConfig.map((anchor) => (
          <Line
            key={anchor.key}
            type="monotone"
            dataKey={anchor.key}
            name={anchor.label}
            stroke={anchor.color}
            strokeWidth={2}
            dot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
