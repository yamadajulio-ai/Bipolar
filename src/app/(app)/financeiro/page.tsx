"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { ImportCSV } from "@/components/financeiro/ImportCSV";
import { TransactionList } from "@/components/financeiro/TransactionList";
import { CategoryChart, MoodSpendingChart } from "@/components/financeiro/FinanceCharts";

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAverage: number;
  transactionCount: number;
  categoryBreakdown: { category: string; total: number }[];
  moodCorrelation: { date: string; spending: number; mood: number | null; energy: number | null }[];
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(async () => {
    const [sumRes, txRes] = await Promise.all([
      fetch("/api/financeiro/resumo?days=30"),
      fetch("/api/financeiro?days=30"),
    ]);
    if (sumRes.ok) setSummary(await sumRes.json());
    if (txRes.ok) setTransactions(await txRes.json());
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Financeiro</h1>
      <p className="mb-6 text-sm text-muted">
        Controle de gastos — importante para estabilidade na bipolaridade.
      </p>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card>
            <p className="text-xs text-muted">Receita</p>
            <p className="text-xl font-bold text-green-600">R$ {summary.totalIncome.toFixed(2)}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Despesa</p>
            <p className="text-xl font-bold text-red-600">R$ {summary.totalExpense.toFixed(2)}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Saldo</p>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              R$ {summary.balance.toFixed(2)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Media/dia</p>
            <p className="text-xl font-bold">R$ {summary.dailyAverage.toFixed(2)}</p>
            <p className="text-xs text-muted">{summary.transactionCount} transacoes</p>
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
          {showForm ? "Fechar" : "+ Adicionar transacao manual"}
        </button>
        {showForm && <ManualEntryForm onCreated={() => { fetchData(); setShowForm(false); }} />}
      </Card>

      {/* Charts */}
      {summary && (
        <>
          {summary.categoryBreakdown.length > 0 && (
            <Card className="mb-6">
              <CategoryChart data={summary.categoryBreakdown} />
            </Card>
          )}
          {summary.moodCorrelation.length >= 3 && (
            <Card className="mb-6">
              <MoodSpendingChart data={summary.moodCorrelation} />
            </Card>
          )}
        </>
      )}

      {/* Transaction list */}
      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Transacoes (30 dias)</h2>
        <TransactionList transactions={transactions} />
      </Card>

      <p className="text-center text-xs text-muted mt-4">
        Gastos elevados em periodos de humor alto podem ser sinal de fase maniaca.
        Compartilhe com seu profissional de saude.
      </p>
    </div>
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
        <label className="text-xs text-muted">Descricao</label>
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
