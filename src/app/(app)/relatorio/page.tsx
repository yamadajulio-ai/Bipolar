"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { MonthSelector } from "@/components/relatorio/MonthSelector";
import { MonthlyReport } from "@/components/relatorio/MonthlyReport";
import { ContextualFeedbackButtons } from "@/components/feedback/ContextualFeedbackButtons";
import { localYearMonth } from "@/lib/dateUtils";

export default function RelatorioPage() {
  const currentMonth = localYearMonth();
  const [month, setMonth] = useState(currentMonth);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<null | any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchReport = useCallback(async (m: string) => {
    try {
      const res = await fetch(`/api/relatorio?month=${m}`);
      if (!res.ok) throw new Error("Erro ao carregar relatório");
      const d = await res.json();
      setData(d);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport(month);
  }, [month, fetchReport]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Relatório Mensal</h1>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <Alert variant="info">
        Relatório educacional para acompanhar seus registros.
        Compartilhe com seu profissional de saúde se achar útil.
        Não substitui avaliação profissional.
      </Alert>

      {loading && (
        <Card>
          <p className="text-center text-muted py-8">Carregando relatório...</p>
        </Card>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {data && !loading && (
        <>
          <MonthlyReport data={data} />
          <div className="mt-6 border-t border-border pt-4">
            <ContextualFeedbackButtons
              contextKey={`report:${month}`}
              question="Este relatório ajudou na consulta?"
            />
          </div>
        </>
      )}
    </div>
  );
}
