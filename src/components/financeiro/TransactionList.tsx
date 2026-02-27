"use client";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string | null;
  source: string;
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted">Nenhuma transacao encontrada.</p>;
  }

  return (
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
          <span
            className={`ml-3 text-sm font-semibold whitespace-nowrap ${
              tx.amount >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {tx.amount >= 0 ? "+" : ""}R$ {formatAmount(tx.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
