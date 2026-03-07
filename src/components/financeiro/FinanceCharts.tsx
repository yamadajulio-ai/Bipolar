"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";

interface CategoryData {
  category: string;
  total: number;
}

interface MoodCorrelation {
  date: string;
  spending: number;
  mood: number | null;
}

interface SpendingTrendData {
  date: string;
  spending: number;
}

export function CategoryChart({ data }: { data: CategoryData[] }) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.category.length > 12 ? d.category.slice(0, 12) + "..." : d.category,
    valor: Math.round(Math.abs(d.total) * 100) / 100,
    isExpense: d.total < 0,
  }));

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Por Categoria</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={75} />
          <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
          <Bar dataKey="valor">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.isExpense ? "#ef4444" : "#22c55e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MoodSpendingChart({ data }: { data: MoodCorrelation[] }) {
  const filtered = data.filter((d) => d.mood !== null && d.spending > 0);
  if (filtered.length < 3) return null;

  const chartData = filtered.map((d) => ({
    date: d.date.slice(8) + "/" + d.date.slice(5, 7),
    gasto: d.spending,
    humor: d.mood,
  }));

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Gasto x Humor</h3>
      <p className="mb-2 text-xs text-muted">
        Correlação entre gastos diários e humor. Gastos elevados em dias de humor alto podem indicar fase maníaca.
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" domain={[1, 5]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="gasto" fill="#ef4444" opacity={0.7} name="Gasto (R$)" />
          <Bar yAxisId="right" dataKey="humor" fill="#3b82f6" opacity={0.7} name="Humor (1-5)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SpendingTrendChart({ data, dailyAverage }: { data: SpendingTrendData[]; dailyAverage: number }) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    date: d.date.slice(8) + "/" + d.date.slice(5, 7),
    gasto: d.spending,
  }));

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Gastos ao longo do mês</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v) => `R$ ${Number(v).toFixed(2)}`} />
          {dailyAverage > 0 && (
            <ReferenceLine
              y={dailyAverage}
              stroke="#f59e0b"
              strokeDasharray="5 3"
              label={{ value: "Média", position: "right", fontSize: 10, fill: "#f59e0b" }}
            />
          )}
          <Line
            type="monotone"
            dataKey="gasto"
            stroke="#ef4444"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Gasto (R$)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
