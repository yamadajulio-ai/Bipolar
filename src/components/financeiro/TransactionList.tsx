"use client";

import { useState } from "react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string | null;
  source: string;
}

export function TransactionList({
  transactions,
  onDeleted,
}: {
  transactions: Transaction[];
  onDeleted?: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (transactions.length === 0) {
    return <p className="text-sm text-muted">Adicione transações para ver como seus gastos se relacionam com seu humor.</p>;
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    setDeleting(id);
    const res = await fetch(`/api/financeiro/${id}`, { method: "DELETE" });
    if (res.ok) {
      onDeleted?.();
    }
    setDeleting(null);
  }

  return (
    <>
      <div className="space-y-1">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{tx.description}</p>
              <p className="text-xs text-muted">
                {formatDate(tx.date)} · {tx.category}
                {tx.account && ` · ${tx.account}`}
              </p>
            </div>
            <div className="ml-3 flex items-center gap-2">
              <span
                className={`text-sm font-semibold whitespace-nowrap ${
                  tx.amount >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {tx.amount >= 0 ? "+" : ""}R$ {formatAmount(tx.amount)}
              </span>
              <button
                onClick={() => setPendingDeleteId(tx.id)}
                disabled={deleting === tx.id}
                className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                title="Excluir transação"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-float)]">
            <p className="mb-4 text-sm font-medium text-foreground">
              Excluir esta transação?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
