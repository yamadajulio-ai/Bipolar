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

interface CategoryData {
  category: string;
  total: number;
}

interface MoodCorrelation {
  date: string;
  spending: number;
  mood: number | null;
}

export function CategoryChart({ data }: { data: CategoryData[] }) {
  if (data.length === 0) return null;

  // Show top 8 categories by absolute value
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
    date: d.date.slice(8) + "/" + d.date.slice(5, 7), // DD/MM
    gasto: d.spending,
    humor: d.mood,
  }));

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Gasto x Humor</h3>
      <p className="mb-2 text-xs text-muted">
        Correlacao entre gastos diarios e humor. Gastos elevados em dias de humor alto podem indicar fase maniaca.
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
