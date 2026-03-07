"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ImportCSV } from "@/components/financeiro/ImportCSV";
import { TransactionList } from "@/components/financeiro/TransactionList";
import { CategoryChart, MoodSpendingChart, SpendingTrendChart } from "@/components/financeiro/FinanceCharts";

interface SpendingAlert {
  date: string;
  spending: number;
  mood: number;
  message: string;
}

interface Comparison {
  prevIncome: number;
  prevExpense: number;
  incomeChange: number | null;
  expenseChange: number | null;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAverage: number;
  transactionCount: number;
  comparison: Comparison | null;
  categoryBreakdown: { category: string; total: number }[];
  moodCorrelation: { date: string; spending: number; mood: number | null; energy: number | null }[];
  spendingAlerts: SpendingAlert[];
  spendingTrend: { date: string; spending: number }[];
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string | null;
  source: string;
}

export default function FinanceiroPage() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    const [sumRes, txRes] = await Promise.all([
      fetch(`/api/financeiro/resumo?month=${month}`),
      fetch(`/api/financeiro?month=${month}`),
    ]);
    if (sumRes.ok) setSummary(await sumRes.json());
    if (txRes.ok) setTransactions(await txRes.json());
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthLabel = new Date(month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted">
            Controle de gastos — importante para estabilidade na bipolaridade.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="fin-month" className="text-sm text-muted">Mês:</label>
          <input
            id="fin-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
        <Image src="/mobills-logo.png" alt="Mobills" width={20} height={20} className="shrink-0" />
        <span className="text-sm font-medium text-green-700">Compatível com Mobills — exporte CSV e importe abaixo</span>
      </div>

      {/* Spending alerts — clinical context */}
      {summary && summary.spendingAlerts.length > 0 && (
        <Alert variant="warning" className="mb-6">
          <p className="font-medium">Atenção: gastos elevados em dias de humor alto</p>
          <ul className="mt-1 space-y-1">
            {summary.spendingAlerts.map((a, i) => (
              <li key={i} className="text-sm">
                {a.date.slice(8)}/{a.date.slice(5, 7)} — R$ {a.spending.toFixed(2)} (humor {a.mood}/5)
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Gastos impulsivos podem ser sinal de fase maníaca. Considere compartilhar com seu profissional de saúde.
          </p>
        </Alert>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Receita"
            value={summary.totalIncome}
            color="text-green-600"
            change={summary.comparison?.incomeChange}
          />
          <SummaryCard
            label="Despesa"
            value={summary.totalExpense}
            color="text-red-600"
            change={summary.comparison?.expenseChange}
            invertChange
          />
          <Card>
            <p className="text-xs text-muted">Saldo</p>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              R$ {summary.balance.toFixed(2)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Média/dia</p>
            <p className="text-xl font-bold">R$ {summary.dailyAverage.toFixed(2)}</p>
            <p className="text-xs text-muted">{summary.transactionCount} transações</p>
          </Card>
        </div>
      )}

      {/* Import */}
      <Card className="mb-6">
        <ImportCSV onImported={fetchData} />
      </Card>

      {/* Manual entry toggle */}
      <Card className="mb-6">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm font-medium text-primary"
        >
          {showForm ? "Fechar" : "+ Adicionar transação manual"}
        </button>
        {showForm && <ManualEntryForm onCreated={() => { fetchData(); setShowForm(false); }} />}
      </Card>

      {/* Insights section */}
      {summary && (
        <div className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Insights financeiros</h2>

          {/* Spending trend */}
          {summary.spendingTrend.length >= 2 && (
            <Card>
              <SpendingTrendChart data={summary.spendingTrend} dailyAverage={summary.dailyAverage} />
            </Card>
          )}

          {/* Category breakdown */}
          {summary.categoryBreakdown.length > 0 && (
            <Card>
              <CategoryChart data={summary.categoryBreakdown} />
            </Card>
          )}

          {/* Mood-spending correlation */}
          {summary.moodCorrelation.length >= 3 && (
            <Card>
              <MoodSpendingChart data={summary.moodCorrelation} />
            </Card>
          )}

          {/* Text insights */}
          {summary.transactionCount > 0 && (
            <Card>
              <h3 className="mb-2 text-sm font-medium">Resumo do mês</h3>
              <ul className="space-y-1.5 text-sm text-muted">
                <li>
                  Você teve <strong className="text-foreground">{summary.transactionCount}</strong> transações em{" "}
                  <strong className="text-foreground">{monthLabel}</strong>.
                </li>
                {summary.categoryBreakdown.length > 0 && (
                  <li>
                    Maior categoria de gasto:{" "}
                    <strong className="text-foreground">
                      {summary.categoryBreakdown.find((c) => c.total < 0)?.category || summary.categoryBreakdown[0].category}
                    </strong>
                  </li>
                )}
                {summary.comparison && summary.comparison.expenseChange !== null && (
                  <li>
                    Despesas{" "}
                    <strong className={summary.comparison.expenseChange > 0 ? "text-red-600" : "text-green-600"}>
                      {summary.comparison.expenseChange > 0 ? "+" : ""}
                      {summary.comparison.expenseChange.toFixed(0)}%
                    </strong>{" "}
                    em relação ao mês anterior
                    {Math.abs(summary.comparison.expenseChange) > 30 && (
                      <span className="text-warning"> — variação significativa</span>
                    )}
                  </li>
                )}
                {summary.moodCorrelation.filter((d) => d.mood !== null && d.mood >= 4 && d.spending > summary.dailyAverage).length > 0 && (
                  <li className="text-warning">
                    Foram identificados dias com humor elevado e gastos acima da média — padrão que merece atenção clínica.
                  </li>
                )}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Transaction list */}
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Transações — {monthLabel}</h2>
        <TransactionList transactions={transactions} onDeleted={fetchData} />
      </Card>

      <p className="text-center text-xs text-muted mt-4">
        Gastos elevados em períodos de humor alto podem ser sinal de fase maníaca.
        Compartilhe com seu profissional de saúde.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  change,
  invertChange,
}: {
  label: string;
  value: number;
  color: string;
  change?: number | null;
  invertChange?: boolean;
}) {
  const changeColor = change != null
    ? (invertChange ? (change > 0 ? "text-red-500" : "text-green-500") : (change > 0 ? "text-green-500" : "text-red-500"))
    : "";

  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-xl font-bold ${color}`}>R$ {value.toFixed(2)}</p>
      {change != null && (
        <p className={`text-xs font-medium ${changeColor}`}>
          {change > 0 ? "+" : ""}{change.toFixed(0)}% vs mês anterior
        </p>
      )}
    </Card>
  );
}

function ManualEntryForm({ onCreated }: { onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const isExpense = fd.get("type") === "despesa";
    const rawAmount = parseFloat(fd.get("amount") as string);

    const body = {
      date: fd.get("date") as string,
      description: fd.get("description") as string,
      amount: isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount),
      category: fd.get("category") as string,
    };

    const res = await fetch("/api/financeiro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Erro ao salvar");
    } else {
      onCreated();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted">Data</label>
          <input name="date" type="date" defaultValue={todayStr} required className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted">Tipo</label>
          <select name="type" className="w-full rounded border border-border bg-surface px-2 py-1 text-sm">
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-muted">Descrição</label>
        <input name="description" type="text" required maxLength={200} className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted">Valor (R$)</label>
          <input name="amount" type="number" step="0.01" min="0.01" required className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted">Categoria</label>
          <input name="category" type="text" required maxLength={100} defaultValue="outro" className="w-full rounded border border-border bg-surface px-2 py-1 text-sm" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading} className="rounded bg-primary px-4 py-1 text-sm text-white disabled:opacity-50">
        {loading ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
