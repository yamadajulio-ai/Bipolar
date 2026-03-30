"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ImportCSV } from "@/components/financeiro/ImportCSV";
import { TransactionList } from "@/components/financeiro/TransactionList";
import dynamic from "next/dynamic";

const ChartSkeleton = () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" />;
const CategoryChart = dynamic(
  () => import("@/components/financeiro/FinanceCharts").then((m) => m.CategoryChart),
  { ssr: false, loading: ChartSkeleton },
);
const MoodSpendingChart = dynamic(
  () => import("@/components/financeiro/FinanceCharts").then((m) => m.MoodSpendingChart),
  { ssr: false, loading: ChartSkeleton },
);
const SpendingTrendChart = dynamic(
  () => import("@/components/financeiro/FinanceCharts").then((m) => m.SpendingTrendChart),
  { ssr: false, loading: ChartSkeleton },
);
const YearlyComparisonChart = dynamic(
  () => import("@/components/financeiro/FinanceCharts").then((m) => m.YearlyComparisonChart),
  { ssr: false, loading: ChartSkeleton },
);
import { localToday, localYearMonth, shiftMonth } from "@/lib/dateUtils";

type DataConfidence = "alta" | "media" | "baixa";

interface SpendingAlert {
  date: string;
  spending: number;
  mood: number;
  message: string;
}

interface SpendingAnomaly {
  date: string;
  spending: number;
  zScore: number;
  mood: number | null;
  energy: number | null;
  type: "spending_spike" | "frequency_spike";
}

interface CorrelationResult {
  rho: number;
  strength: "muito_fraca" | "fraca" | "moderada" | "forte";
  direction: "positiva" | "negativa";
  n: number;
  confidence: DataConfidence;
}

interface CategoryChange {
  category: string;
  current: number;
  previous: number;
  changePct: number;
}

interface Comparison {
  prevIncome: number;
  prevExpense: number;
  incomeChange: number | null;
  expenseChange: number | null;
}

interface SustainedIncrease {
  totalLast7d: number;
  baseline7d: number;
  ratio: number;
}

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  dailyAverage: number;
  dailyMedian: number;
  dailyMAD: number;
  dataConfidence: DataConfidence;
  transactionCount: number;
  comparison: Comparison | null;
  categoryBreakdown: { category: string; total: number }[];
  categoryChanges: CategoryChange[];
  moodCorrelation: { date: string; spending: number; mood: number | null; energy: number | null }[];
  sameDayCorrelation: CorrelationResult | null;
  lagCorrelation: CorrelationResult | null;
  spendingAlerts: SpendingAlert[];
  spendingAnomalies: SpendingAnomaly[];
  spendingTrend: { date: string; spending: number }[];
  sustainedIncrease: SustainedIncrease | null;
  nightTransactions: number;
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
  const currentMonth = localYearMonth();
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [yearlyData, setYearlyData] = useState<{ month: string; label: string; income: number; expense: number }[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/financeiro/resumo?month=${month}`),
      fetch(`/api/financeiro?month=${month}`),
    ]).then(async ([sumRes, txRes]) => {
      if (sumRes.ok) setSummary(await sumRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    }).catch(() => {});
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/financeiro/historico")
      .then((r) => (r.ok ? r.json() : []))
      .then(setYearlyData)
      .catch(() => setYearlyData([]));
  }, []);

  const monthLabel = new Date(month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted">
            Controle de gastos — importante para a sua estabilidade.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="rounded p-1.5 text-muted hover:bg-surface-alt hover:text-foreground"
            aria-label="Mês anterior"
          >
            &#8249;
          </button>
          <input
            id="fin-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-control-border bg-surface px-2 py-1 text-sm"
          />
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= currentMonth}
            className="rounded p-1.5 text-muted hover:bg-surface-alt hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Próximo mês"
          >
            &#8250;
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted italic">Este recurso não substitui avaliação profissional.</p>

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-success-border bg-success-bg-subtle px-4 py-2.5">
        <span className="text-sm font-medium text-success-fg">
          Compatível com Mobills, Nubank, Inter, Itaú e mais — importe CSV, XLSX ou OFX
        </span>
      </div>

      {/* Sustained increase alert (7d >= 1.8x baseline) */}
      {summary?.sustainedIncrease && (
        <Alert variant="danger" className="mb-6">
          <p className="font-medium">Aumento sustentado nos gastos</p>
          <p className="mt-1 text-sm">
            Nos últimos 7 dias, seus gastos somaram{" "}
            <strong>R$ {summary.sustainedIncrease.totalLast7d.toFixed(2)}</strong> —{" "}
            <strong>{summary.sustainedIncrease.ratio.toFixed(1)}x</strong> acima da sua linha de base semanal
            (R$ {summary.sustainedIncrease.baseline7d.toFixed(2)}).
          </p>
          <p className="mt-2 text-xs">
            Aumento persistente nos gastos pode indicar fase maníaca em desenvolvimento.
            Considere compartilhar com seu profissional de saúde.
          </p>
          <AlertFeedbackButtons
            alertType="sustained_increase"
            alertDate={new Date().toISOString().slice(0, 10)}
          />
        </Alert>
      )}

      {/* Spending anomalies — robust z-score detection */}
      {summary && summary.spendingAnomalies.length > 0 && (() => {
        // Severity elevation: escalate to danger only when BOTH mood AND energy are elevated (reduces false positives)
        const hasConvergence = summary.spendingAnomalies.some(
          (a) => a.mood !== null && a.mood >= 4 && a.energy !== null && a.energy >= 4
        );
        const variant = hasConvergence ? "danger" as const : "warning" as const;
        return (
          <Alert variant={variant} className="mb-6">
            <p className="font-medium">
              {hasConvergence ? "Alerta clínico: gastos atípicos + sinais de elevação" : "Gastos atípicos detectados"}
            </p>
            <ul className="mt-1 space-y-1">
              {summary.spendingAnomalies.slice(0, 5).map((a, i) => (
                <li key={i} className="text-sm">
                  {a.date.slice(8)}/{a.date.slice(5, 7)} — R$ {a.spending.toFixed(2)}
                  {a.type === "spending_spike" ? " (valor atípico)" : " (muitas transações)"}
                  {a.mood !== null && a.mood >= 4 && (
                    <span className="text-danger-fg font-medium"> + humor alto ({a.mood}/5)</span>
                  )}
                  {a.energy !== null && a.energy >= 4 && (
                    <span className="text-danger-fg font-medium"> + energia alta ({a.energy}/5)</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              {hasConvergence
                ? "Gastos atípicos combinados com humor/energia elevados são padrão de risco. Converse com seu profissional de saúde."
                : "Baseado em mediana + desvio absoluto mediano. Gastos impulsivos podem ser sinal de fase maníaca."}
            </p>
            <AlertFeedbackButtons
              alertType={summary.spendingAnomalies[0].type}
              alertDate={summary.spendingAnomalies[0].date}
            />
          </Alert>
        );
      })()}

      {/* Clinical spending alerts (high mood + high spending) */}
      {summary && summary.spendingAlerts.length > 0 && summary.spendingAnomalies.length === 0 && (
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

      {/* Empty state for new users */}
      {summary && summary.transactionCount === 0 && (
        <div className="mb-6 rounded-[var(--radius-panel)] border border-border bg-surface p-6 text-center">
          <p className="text-3xl mb-2">💰</p>
          <h2 className="text-lg font-semibold mb-1">Comece a acompanhar seus gastos</h2>
          <p className="text-sm text-muted mb-3">
            Acompanhar seus gastos ajuda a identificar padrões que podem estar ligados ao humor.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-2 text-left">
            <button
              onClick={() => {
                const el = document.getElementById("import-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-lg border border-border p-3 hover:bg-surface-alt transition-colors text-left"
            >
              <p className="text-sm font-medium">📄 Importar arquivo</p>
              <p className="text-xs text-muted">CSV, XLSX ou OFX do seu banco ou app</p>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-border p-3 hover:bg-surface-alt transition-colors text-left"
            >
              <p className="text-sm font-medium">✏️ Adicionar manual</p>
              <p className="text-xs text-muted">Digite uma transação rápida</p>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("import-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-lg border border-border p-3 hover:bg-surface-alt transition-colors text-left"
            >
              <p className="text-sm font-medium">💬 Via WhatsApp</p>
              <p className="text-xs text-muted">Envie o extrato pelo WhatsApp</p>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("import-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-lg border border-border p-3 hover:bg-surface-alt transition-colors text-left"
            >
              <p className="text-sm font-medium">📧 Via Email</p>
              <p className="text-xs text-muted">Envie o extrato por email</p>
            </button>
          </div>
          <p className="text-xs text-muted">
            Compatível com Nubank, Inter, Itaú, Mobills e mais
          </p>
        </div>
      )}

      {/* Summary cards */}
      {summary && summary.transactionCount > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Receita"
            value={summary.totalIncome}
            color="text-success-fg"
            change={summary.comparison?.incomeChange}
          />
          <SummaryCard
            label="Despesa"
            value={summary.totalExpense}
            color="text-danger-fg"
            change={summary.comparison?.expenseChange}
            invertChange
          />
          <Card>
            <p className="text-xs text-muted">Saldo</p>
            <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-success-fg" : "text-danger-fg"}`}>
              R$ {summary.balance.toFixed(2)}
            </p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Mediana/dia</p>
            <p className="text-xl font-bold">R$ {summary.dailyMedian.toFixed(2)}</p>
            <p className="text-xs text-muted">{summary.transactionCount} transações</p>
            <ConfidenceBadge confidence={summary.dataConfidence} />
          </Card>
        </div>
      )}

      {/* Import */}
      <div id="import-section">
        <Card className="mb-6">
          <ImportCSV onImported={fetchData} />
        </Card>
      </div>

      {/* Manual entry — prominent quick-add form */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Adicionar transacao</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-medium text-primary"
          >
            {showForm ? "Fechar" : "+ Nova transacao"}
          </button>
        </div>
        {showForm && <ManualEntryForm onCreated={() => { fetchData(); setShowForm(false); }} />}
      </Card>

      {/* Insights section */}
      {summary && (
        <div className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Insights financeiros</h2>

          {/* Spending trend */}
          {summary.spendingTrend.length >= 2 && (
            <Card>
              <SpendingTrendChart data={summary.spendingTrend} dailyAverage={summary.dailyAverage} dailyMedian={summary.dailyMedian} />
            </Card>
          )}

          {/* Category breakdown */}
          {summary.categoryBreakdown.length > 0 && (
            <Card>
              <CategoryChart data={summary.categoryBreakdown} />
              <CategoryClassification data={summary.categoryBreakdown} />
            </Card>
          )}

          {/* Category changes vs previous month */}
          {summary.categoryChanges.length > 0 && (
            <Card>
              <h3 className="mb-2 text-sm font-medium">Categorias com aumento significativo</h3>
              <ul className="space-y-1.5">
                {summary.categoryChanges.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{c.category}</span>
                    <span>
                      <span className="text-muted">R$ {c.previous.toFixed(0)}</span>
                      <span className="mx-1 text-muted">&rarr;</span>
                      <span className="text-danger-fg font-medium">R$ {c.current.toFixed(0)}</span>
                      <span className="ml-1 text-xs text-danger-fg">(+{c.changePct.toFixed(0)}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">
                Categorias com aumento de 60%+ e que representam 20%+ do total de despesas.
              </p>
            </Card>
          )}

          {/* 12-month comparison */}
          {yearlyData.length >= 2 && (
            <Card>
              <YearlyComparisonChart data={yearlyData} />
            </Card>
          )}

          {/* Mood-spending correlation */}
          {summary.moodCorrelation.length >= 3 && (
            <Card>
              <MoodSpendingChart data={summary.moodCorrelation} />
            </Card>
          )}

          {/* Correlation cards */}
          {(summary.sameDayCorrelation || summary.lagCorrelation) && (
            <Card>
              <h3 className="mb-2 text-sm font-medium">Relação entre gastos e humor</h3>
              <div className="space-y-2">
                {summary.sameDayCorrelation && (
                  <CorrelationCard
                    label="Mesmo dia"
                    corr={summary.sameDayCorrelation}
                    description="Relação entre gasto e humor no mesmo dia"
                  />
                )}
                {summary.lagCorrelation && (
                  <CorrelationCard
                    label="Dia seguinte (lag-1)"
                    corr={summary.lagCorrelation}
                    description="Relação entre gasto hoje e humor amanhã"
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                Correlação não prova causa. Valores próximos de 0 indicam pouca relação linear.
              </p>
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
                <li>
                  Gasto diário: mediana <strong className="text-foreground">R$ {summary.dailyMedian.toFixed(2)}</strong>,
                  média <strong className="text-foreground">R$ {summary.dailyAverage.toFixed(2)}</strong>
                  {summary.dailyMAD > 0 && (
                    <span> (variabilidade: MAD R$ {summary.dailyMAD.toFixed(2)})</span>
                  )}
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
                    <strong className={summary.comparison.expenseChange > 0 ? "text-danger-fg" : "text-success-fg"}>
                      {summary.comparison.expenseChange > 0 ? "+" : ""}
                      {summary.comparison.expenseChange.toFixed(0)}%
                    </strong>{" "}
                    em relação ao mês anterior
                    {Math.abs(summary.comparison.expenseChange) > 30 && (
                      <span className="text-warning-fg"> — variação significativa</span>
                    )}
                  </li>
                )}
                {summary.nightTransactions > 0 && (
                  <li className="text-warning-fg">
                    {summary.nightTransactions} transação(ões) registrada(s) entre 00h e 06h — gastos noturnos merecem atenção.
                  </li>
                )}
                {summary.moodCorrelation.filter((d) => d.mood !== null && d.mood >= 4 && d.spending > summary.dailyMedian).length > 0 && (
                  <li className="text-warning-fg">
                    Foram identificados dias com humor elevado e gastos acima da mediana — padrão que merece atenção clínica.
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

function ConfidenceBadge({ confidence }: { confidence: DataConfidence }) {
  const colors = {
    alta: "bg-success-bg-subtle text-success-fg",
    media: "bg-warning-bg-subtle text-warning-fg",
    baixa: "bg-danger-bg-subtle text-danger-fg",
  };
  const labels = { alta: "Alta", media: "Média", baixa: "Baixa" };
  return (
    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${colors[confidence]}`}>
      Confiança: {labels[confidence]}
    </span>
  );
}

function CorrelationCard({ label, corr, description }: { label: string; corr: CorrelationResult; description: string }) {
  const strengthLabels = {
    muito_fraca: "Muito fraca",
    fraca: "Fraca",
    moderada: "Moderada",
    forte: "Forte",
  };
  const strengthColors = {
    muito_fraca: "text-muted",
    fraca: "text-amber-600 dark:text-amber-400",
    moderada: "text-orange-600 dark:text-orange-400",
    forte: "text-danger-fg",
  };

  return (
    <div className="rounded border border-border p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <ConfidenceBadge confidence={corr.confidence} />
      </div>
      <p className="text-xs text-muted mt-0.5">{description}</p>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="text-lg font-bold">
          rho = {corr.rho > 0 ? "+" : ""}{corr.rho.toFixed(2)}
        </span>
        <span className={`text-xs font-medium ${strengthColors[corr.strength]}`}>
          {strengthLabels[corr.strength]} ({corr.direction})
        </span>
        <span className="text-xs text-muted">n={corr.n}</span>
      </div>
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
    ? (invertChange ? (change > 0 ? "text-danger-fg" : "text-success-fg") : (change > 0 ? "text-success-fg" : "text-danger-fg"))
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

const COMMON_CATEGORIES = [
  "Alimentacao",
  "Transporte",
  "Saude",
  "Farmacia",
  "Lazer",
  "Educacao",
  "Moradia",
  "Mercado",
  "Vestuario",
  "Assinatura",
  "Delivery",
  "Presente",
  "Salario",
  "Freelance",
  "Outro",
];

function ManualEntryForm({ onCreated }: { onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = localToday();

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
      category: (fd.get("category") as string).trim() || "Outro",
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
      {/* Row 1: Valor + Tipo (most important fields first) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="manual-amount" className="text-xs text-muted">Valor (R$)</label>
          <input
            id="manual-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0,00"
            className="w-full rounded border border-control-border bg-surface px-3 py-2 text-sm"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="manual-type" className="text-xs text-muted">Tipo</label>
          <select
            id="manual-type"
            name="type"
            className="w-full rounded border border-control-border bg-surface px-3 py-2 text-sm"
          >
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </div>
      </div>

      {/* Row 2: Categoria (dropdown with suggestions) + Data */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="manual-category" className="text-xs text-muted">Categoria</label>
          <input
            id="manual-category"
            name="category"
            type="text"
            required
            maxLength={100}
            list="category-suggestions"
            placeholder="Selecione ou digite"
            className="w-full rounded border border-control-border bg-surface px-3 py-2 text-sm"
          />
          <datalist id="category-suggestions">
            {COMMON_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="manual-date" className="text-xs text-muted">Data</label>
          <input
            id="manual-date"
            name="date"
            type="date"
            defaultValue={todayStr}
            required
            className="w-full rounded border border-control-border bg-surface px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Row 3: Descricao (optional context) */}
      <div>
        <label htmlFor="manual-description" className="text-xs text-muted">Descricao (opcional)</label>
        <input
          id="manual-description"
          name="description"
          type="text"
          required
          maxLength={200}
          placeholder="Ex: Supermercado, Uber, etc."
          className="w-full rounded border border-control-border bg-surface px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-primary-dark transition-colors"
      >
        {loading ? "Salvando..." : "Salvar transacao"}
      </button>
    </form>
  );
}

// ── Fixed vs Variable category classification ────────────────────
const FIXED_CATEGORIES = new Set([
  "aluguel", "condomínio", "condominio", "iptu", "seguro",
  "plano de saúde", "plano de saude", "internet", "telefone",
  "energia", "luz", "água", "agua", "gás", "gas",
  "escola", "faculdade", "mensalidade", "financiamento",
  "streaming", "assinatura", "academia",
]);

function classifyCategory(name: string): "fixo" | "variável" {
  return FIXED_CATEGORIES.has(name.toLowerCase()) ? "fixo" : "variável";
}

function CategoryClassification({ data }: { data: { category: string; total: number }[] }) {
  const expenses = data.filter((d) => d.total < 0);
  if (expenses.length === 0) return null;

  let fixoTotal = 0;
  let variavelTotal = 0;
  for (const d of expenses) {
    const abs = Math.abs(d.total);
    if (classifyCategory(d.category) === "fixo") fixoTotal += abs;
    else variavelTotal += abs;
  }
  const total = fixoTotal + variavelTotal;
  if (total === 0) return null;

  const fixoPct = Math.round((fixoTotal / total) * 100);

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <h4 className="text-xs font-medium text-muted mb-1.5">Fixo vs Variável</h4>
      <div className="flex gap-2 text-sm">
        <div className="flex-1 rounded bg-info-bg-subtle p-2 text-center">
          <p className="text-xs text-info-fg">Fixo</p>
          <p className="font-bold text-info-fg">R$ {fixoTotal.toFixed(0)}</p>
          <p className="text-xs text-info-fg">{fixoPct}%</p>
        </div>
        <div className="flex-1 rounded bg-orange-50 dark:bg-orange-950/30 p-2 text-center">
          <p className="text-xs text-orange-600 dark:text-orange-400">Variável</p>
          <p className="font-bold text-orange-700 dark:text-orange-300">R$ {variavelTotal.toFixed(0)}</p>
          <p className="text-xs text-orange-500 dark:text-orange-400">{100 - fixoPct}%</p>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Gastos variáveis elevados merecem atenção. Classificação automática por categoria.
      </p>
    </div>
  );
}

// ── Alert feedback buttons ───────────────────────────────────────
function AlertFeedbackButtons({ alertType, alertDate }: { alertType: string; alertDate: string }) {
  const [sent, setSent] = useState<boolean | null>(null);

  async function send(useful: boolean) {
    setSent(useful);
    fetch("/api/financeiro/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertType, alertDate, useful }),
    }).catch(() => {});
  }

  if (sent !== null) {
    return (
      <p className="mt-2 text-xs text-muted">
        {sent ? "Obrigado pelo feedback!" : "Entendido, vamos melhorar."}
      </p>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-muted">Este alerta foi útil?</span>
      <button
        onClick={() => send(true)}
        className="rounded border border-success-border px-2 py-0.5 text-xs text-success-fg hover:bg-success-bg-subtle"
      >
        Sim
      </button>
      <button
        onClick={() => send(false)}
        className="rounded border border-danger-border px-2 py-0.5 text-xs text-danger-fg hover:bg-danger-bg-subtle"
      >
        Não
      </button>
    </div>
  );
}
