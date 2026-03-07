"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { RegularityMeter } from "@/components/RegularityMeter";
import { RhythmChart } from "@/components/charts/RhythmChart";

interface AnchorStats {
  avg: string;
  stdDev: number;
  regularity: number;
}

interface TrendData {
  anchors: Record<string, AnchorStats>;
  overallRegularity: number;
  entries: Array<{
    date: string;
    wakeTime?: string | null;
    firstContact?: string | null;
    mainActivityStart?: string | null;
    dinnerTime?: string | null;
    bedtime?: string | null;
  }>;
}

const anchorLabels: Record<string, string> = {
  wakeTime: "Horário que acordou",
  firstContact: "Primeiro contato social",
  mainActivityStart: "Início da atividade principal",
  dinnerTime: "Horário do jantar",
  bedtime: "Horário que foi dormir",
};

export default function TendenciasPage() {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/rotina/tendencias?days=30");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="py-12 text-center text-muted">Carregando...</p>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Tendências de Regularidade</h1>
        <Card>
          <p className="text-center text-muted">
            Sem dados suficientes. Registre pelo menos alguns dias de rotina para
            ver suas tendências.
          </p>
        </Card>
        <Link
          href="/rotina"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Voltar para Ritmo Social
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Tendências de Regularidade</h1>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Regularidade geral</h2>
        <RegularityMeter
          value={data.overallRegularity}
          label="Índice geral de regularidade"
        />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Por âncora temporal</h2>
        {Object.entries(data.anchors).map(([key, stats]) => (
          <div key={key} className="mb-3">
            <RegularityMeter
              value={stats.regularity}
              label={anchorLabels[key] || key}
            />
            <p className="text-xs text-muted">
              Media: {stats.avg} | Desvio padrao: {stats.stdDev} min
            </p>
          </div>
        ))}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">Grafico de ritmos</h2>
        <RhythmChart entries={data.entries} />
      </Card>

      <Alert variant="info" className="mb-4">
        Dados dos ultimos 30 dias. Quanto mais regular sua rotina, mais estavel
        tende a ser o humor no transtorno bipolar.
      </Alert>

      <Link
        href="/rotina"
        className="text-sm text-primary hover:underline"
      >
        Voltar para Ritmo Social
      </Link>
    </div>
  );
}
