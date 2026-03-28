"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { PeriodSelector } from "@/components/charts/PeriodSelector";
import dynamic from "next/dynamic";

const MoodSleepChart = dynamic(
  () => import("@/components/charts/MoodSleepChart").then((m) => m.MoodSleepChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
const MoodDistribution = dynamic(
  () => import("@/components/charts/MoodDistribution").then((m) => m.MoodDistribution),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
import { AlertasPadrao } from "@/components/AlertasPadrao";
import { MOOD_LABELS } from "@/lib/constants";

interface Entry {
  id: string;
  date: string;
  mood: number;
  sleepHours: number;
  energyLevel: number | null;
  anxietyLevel: number | null;
  irritability: number | null;
  tookMedication: string | null;
  warningSigns: string | null;
}

interface Stats {
  avgMood: number;
  avgSleep: number;
  totalEntries: number;
}

interface TendenciasData {
  entries: Entry[];
  stats: Stats;
  alerts: string[];
}

export default function TendenciasPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<TendenciasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (period: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/diario/tendencias?days=${period}`);
      if (!res.ok) {
        setError("Erro ao carregar dados.");
        return;
      }
      const json: TendenciasData = await res.json();
      setData(json);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  function handlePeriodChange(newDays: number) {
    setDays(newDays);
  }

  function moodLabel(avg: number): string {
    const rounded = Math.round(avg);
    return MOOD_LABELS[rounded] || String(avg);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tendências</h1>
        <Link
          href="/diario"
          className="text-sm text-primary hover:underline"
        >
          Voltar ao histórico
        </Link>
      </div>

      <div className="mb-6">
        <PeriodSelector value={days} onChange={handlePeriodChange} />
      </div>

      {loading && (
        <p className="py-8 text-center text-muted">Carregando dados...</p>
      )}

      {error && (
        <p className="py-8 text-center text-danger-fg">{error}</p>
      )}

      {!loading && !error && data && (
        <>
          {data.alerts.length > 0 && (
            <div className="mb-6">
              <AlertasPadrao alerts={data.alerts} />
            </div>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-xs text-muted">Humor médio</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {data.stats.avgMood}
              </p>
              <p className="text-xs text-muted">
                {moodLabel(data.stats.avgMood)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Sono médio</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {data.stats.avgSleep}h
              </p>
            </Card>
            <Card>
              <p className="text-xs text-muted">Total de registros</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {data.stats.totalEntries}
              </p>
            </Card>
          </div>

          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">Humor e Sono ao longo do tempo</h2>
            <MoodSleepChart entries={data.entries} />
          </Card>

          <Card className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">Distribuição de humor</h2>
            <MoodDistribution entries={data.entries} />
          </Card>
        </>
      )}
    </div>
  );
}
