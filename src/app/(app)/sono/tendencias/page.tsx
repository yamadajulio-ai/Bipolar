"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { SleepChart } from "@/components/charts/SleepChart";

interface TrendData {
  totalLogs: number;
  avgHours: number;
  avgQuality: number;
  avgAwakenings: number;
  bedtimeVariance: number;
  alerts: string[];
  logs: { date: string; totalHours: number; quality: number; awakenings: number; bedtime: string }[];
}

const periodOptions = [
  { value: 7, label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
];

const qualityLabels: Record<number, string> = {
  1: "Pessima",
  2: "Ruim",
  3: "Regular",
  4: "Boa",
  5: "Otima",
};

function getQualityLabel(avg: number): string {
  const rounded = Math.round(avg);
  return qualityLabels[rounded] || "---";
}

export default function TendenciasSonoPage() {
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (days: number) => {
    try {
      const res = await fetch(`/api/sono/tendencias?days=${days}`);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const json = await res.json();
      setData(json);
      setError("");
    } catch {
      setError("Erro ao carregar tendencias. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tendencias de Sono</h1>
        <Link
          href="/sono"
          className="text-sm text-primary hover:underline"
        >
          &larr; Voltar
        </Link>
      </div>

      <div className="mb-6 flex gap-2">
        {periodOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setPeriod(option.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              period === option.value
                ? "border-primary bg-primary text-white"
                : "border-border bg-surface text-muted hover:border-primary/50"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {loading ? (
        <Card>
          <p className="text-center text-muted py-4">Carregando...</p>
        </Card>
      ) : data && data.totalLogs === 0 ? (
        <Card>
          <p className="text-center text-muted">
            Nenhum registro de sono neste periodo.{" "}
            <Link href="/sono/novo" className="text-primary hover:underline">
              Criar registro
            </Link>
          </p>
        </Card>
      ) : data ? (
        <>
          {data.alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {data.alerts.map((alert, i) => (
                <Alert key={i} variant="warning">
                  {alert}
                </Alert>
              ))}
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-muted">Media de horas</p>
              <p className="text-2xl font-bold">{data.avgHours}h</p>
              <p className="text-xs text-muted">{data.totalLogs} registros</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Media de qualidade</p>
              <p className="text-2xl font-bold">{data.avgQuality}</p>
              <p className="text-xs text-muted">{getQualityLabel(data.avgQuality)}</p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Media de despertares</p>
              <p className="text-2xl font-bold">{data.avgAwakenings}</p>
              <p className="text-xs text-muted">por noite</p>
            </Card>
          </div>

          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">Grafico de Sono</h2>
            <SleepChart data={data.logs} />
          </Card>
        </>
      ) : null}
    </div>
  );
}
