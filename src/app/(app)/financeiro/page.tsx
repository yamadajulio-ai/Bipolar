"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ImportCSV } from "@/components/financeiro/ImportCSV";
import { TransactionList } from "@/components/financeiro/TransactionList";
import { CategoryChart, MoodSpendingChart, SpendingTrendChart, YearlyComparisonChart } from "@/components/financeiro/FinanceCharts";

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

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
  const [yearlyData, setYearlyData] = useState<{ month: string; label: string; income: number; expense: number }[]>([]);
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
            className="rounded border border-border bg-surface px-2 py-1 text-sm"
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

      <div className="mb-6 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
        <Image src="/mobills-logo.png" alt="Mobills" width={20} height={20} className="shrink-0" />
        <span className="text-sm font-medium text-green-700">Compatível com Mobills — exporte CSV e importe abaixo</span>
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
                    <span className="text-red-600 font-medium"> + humor alto ({a.mood}/5)</span>
                  )}
                  {a.energy !== null && a.energy >= 4 && (
                    <span className="text-red-600 font-medium"> + energia alta ({a.energy}/5)</span>
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
            <p className="text-xs text-muted">Mediana/dia</p>
            <p className="text-xl font-bold">R$ {summary.dailyMedian.toFixed(2)}</p>
            <p className="text-xs text-muted">{summary.transactionCount} transações</p>
            <ConfidenceBadge confidence={summary.dataConfidence} />
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
                      <span className="text-red-600 font-medium">R$ {c.current.toFixed(0)}</span>
                      <span className="ml-1 text-xs text-red-500">(+{c.changePct.toFixed(0)}%)</span>
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
                {summary.nightTransactions > 0 && (
                  <li className="text-warning">
                    {summary.nightTransactions} transação(ões) registrada(s) entre 00h e 06h — gastos noturnos merecem atenção.
                  </li>
                )}
                {summary.moodCorrelation.filter((d) => d.mood !== null && d.mood >= 4 && d.spending > summary.dailyMedian).length > 0 && (
                  <li className="text-warning">
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
    alta: "bg-green-100 text-green-700",
    media: "bg-amber-100 text-amber-700",
    baixa: "bg-red-100 text-red-700",
  };
  const labels = { alta: "Alta", media: "Média", baixa: "Baixa" };
  return (
    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[confidence]}`}>
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
    muito_fraca: "text-gray-500",
    fraca: "text-amber-600",
    moderada: "text-orange-600",
    forte: "text-red-600",
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
        <div className="flex-1 rounded bg-blue-50 p-2 text-center">
          <p className="text-xs text-blue-600">Fixo</p>
          <p className="font-bold text-blue-700">R$ {fixoTotal.toFixed(0)}</p>
          <p className="text-xs text-blue-500">{fixoPct}%</p>
        </div>
        <div className="flex-1 rounded bg-orange-50 p-2 text-center">
          <p className="text-xs text-orange-600">Variável</p>
          <p className="font-bold text-orange-700">R$ {variavelTotal.toFixed(0)}</p>
          <p className="text-xs text-orange-500">{100 - fixoPct}%</p>
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
        className="rounded border border-green-300 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50"
      >
        Sim
      </button>
      <button
        onClick={() => send(false)}
        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50"
      >
        Não
      </button>
    </div>
  );
}
