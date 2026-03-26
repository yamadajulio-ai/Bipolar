"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";
import { localToday } from "@/lib/dateUtils";

const QUICK_CATEGORIES = [
  "Alimentacao", "Transporte", "Mercado", "Delivery",
  "Farmacia", "Lazer", "Saude", "Outro",
];

export function QuickSpend() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    const val = parseFloat(amount.replace(",", "."));
    if (!val || val <= 0 || !category) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localToday(),
          description: category,
          amount: -Math.abs(val),
          category,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setAmount("");
        setCategory("");
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Gasto rápido</h2>
        <Link href="/financeiro" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </div>

      {success ? (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center dark:bg-emerald-950 dark:border-emerald-800">
          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">Registrado!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Amount input */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted font-medium">R$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(category === cat ? "" : cat)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-primary text-white"
                    : "bg-surface-alt text-foreground/70 hover:bg-primary/10"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !amount || !category}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px]"
          >
            {saving ? "Salvando..." : "Registrar gasto"}
          </button>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 text-center">{error}</p>
          )}
        </div>
      )}
    </Card>
  );
}
