"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/Card";

interface PatientReport {
  patientName: string;
  generatedAt: string;
  period: { from: string; to: string };
  insights: {
    sleep: {
      avgDuration: number | null;
      bedtimeVariance: number | null;
      sleepTrend: string | null;
      sleepTrendDelta: number | null;
      avgQuality: number | null;
      recordCount: number;
      sleepHeadline: string | null;
      alerts: { variant: string; title: string; message: string }[];
    };
    mood: {
      moodTrend: string | null;
      moodAmplitude: number | null;
      moodAmplitudeLabel: string | null;
      medicationAdherence: number | null;
      topWarningSigns: { key: string; label: string; count: number }[];
      moodHeadline: string | null;
      alerts: { variant: string; title: string; message: string }[];
    };
    rhythm: {
      overallRegularity: number | null;
      hasEnoughData: boolean;
    };
    thermometer: {
      position: number;
      maniaScore: number;
      depressionScore: number;
      zone: string;
      zoneLabel: string;
      mixedFeatures: boolean;
      instability: string;
      factors: string[];
      daysUsed: number;
    } | null;
    risk: {
      score: number;
      level: string;
      factors: string[];
    } | null;
    combinedPatterns: { variant: string; title: string; message: string }[];
  };
  rawData: {
    entries: {
      date: string;
      mood: number;
      energy: number | null;
      anxiety: number | null;
      irritability: number | null;
      medication: string | null;
      warningSigns: string | null;
    }[];
    sleepLogs: {
      date: string;
      bedtime: string;
      wakeTime: string;
      totalHours: number;
      quality: number;
      hrv: number | null;
      heartRate: number | null;
    }[];
  };
  medications: string | null;
  sosEvents: { action: string; date: string }[];
  weeklyAssessments?: {
    date: string;
    asrmTotal: number | null;
    phq9Total: number | null;
    phq9Item9: number | null;
    fastAvg: number | null;
    notes: string | null;
  }[];
  lifeChartEvents?: {
    date: string;
    eventType: string;
    label: string;
    notes: string | null;
  }[];
  functioningAssessments?: {
    date: string;
    avgScore: number | null;
  }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

export default function ProfessionalDashboard() {
  const params = useParams();
  const token = params.token as string;
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PatientReport | null>(null);

  async function handleAccess() {
    if (pin.length !== 6) {
      setError("Digite o PIN de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/acesso-profissional/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        let msg = "Erro ao acessar.";
        try {
          const err = await res.json();
          msg = err?.error || msg;
        } catch { /* keep default */ }
        setError(msg);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  // PIN entry screen
  if (!report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
        <Card className="w-full max-w-md">
          <h1 className="mb-2 text-center text-xl font-bold">
            Suporte Bipolar — Painel do Profissional
          </h1>
          <p className="mb-6 text-center text-sm text-muted">
            Digite o PIN fornecido pelo paciente para acessar os dados.
          </p>

          <input
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="mb-4 w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.5em]"
            autoFocus
          />

          {error && (
            <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={handleAccess}
            disabled={loading || pin.length !== 6}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Acessar dados"}
          </button>

          <p className="mt-4 text-center text-[10px] text-muted">
            Acesso protegido por PIN. Os dados são somente leitura.
            O paciente pode revogar este acesso a qualquer momento.
          </p>
        </Card>
      </div>
    );
  }

  // Professional dashboard
  const { insights, rawData } = report;

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                Relatório — {report.patientName}
              </h1>
              <p className="text-sm text-muted">
                Período: {report.period.from} a {report.period.to}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:bg-gray-100 dark:hover:bg-gray-800 print:hidden"
              >
                Exportar PDF / Imprimir
              </button>
              <div className="text-right text-xs text-muted">
                <p>Gerado em {formatDate(report.generatedAt)}</p>
                <p>Suporte Bipolar</p>
              </div>
            </div>
          </div>
        </div>

        {/* Thermometer */}
        {insights.thermometer && (
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">
              Termômetro de Humor (espectro bipolar)
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span className="text-2xl font-bold">
                  {insights.thermometer.zoneLabel}
                </span>
                {insights.thermometer.mixedFeatures && (
                  <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    Misto
                  </span>
                )}
              </div>
              <div className="text-sm text-muted">
                <p>Score D: {insights.thermometer.depressionScore} | Score M: {insights.thermometer.maniaScore}</p>
                <p>Oscilação: {insights.thermometer.instability}</p>
                <p>Posição: {insights.thermometer.position}/100</p>
              </div>
            </div>
            {insights.thermometer.factors.length > 0 && (
              <p className="mt-2 text-xs text-muted">
                Fatores: {insights.thermometer.factors.join(", ")}
              </p>
            )}
          </Card>
        )}

        {/* Risk + Combined Patterns */}
        {insights.risk && (
          <Card className="mb-4">
            <h2 className="mb-2 text-sm font-semibold">Status Heurístico</h2>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  insights.risk.level === "ok"
                    ? "bg-green-100 text-green-800"
                    : insights.risk.level === "atencao"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-red-100 text-red-800"
                }`}
              >
                {insights.risk.level === "ok"
                  ? "Estável"
                  : insights.risk.level === "atencao"
                    ? "Atenção"
                    : "Atenção Alta"}
              </span>
              <span className="text-sm text-muted">
                Score: {insights.risk.score}
              </span>
            </div>
            {insights.risk.factors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {insights.risk.factors.map((f, i) => (
                  <li key={i} className="text-xs text-muted">
                    • {f}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* Sleep Summary */}
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Sono</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-muted">Média</td>
                  <td className="py-1 text-right font-medium">
                    {insights.sleep.avgDuration !== null
                      ? formatDuration(insights.sleep.avgDuration)
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">Regularidade</td>
                  <td className="py-1 text-right font-medium">
                    {insights.sleep.bedtimeVariance !== null
                      ? `±${insights.sleep.bedtimeVariance}min`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">Qualidade</td>
                  <td className="py-1 text-right font-medium">
                    {insights.sleep.avgQuality !== null
                      ? `${insights.sleep.avgQuality}%`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">Registros</td>
                  <td className="py-1 text-right font-medium">
                    {insights.sleep.recordCount}
                  </td>
                </tr>
              </tbody>
            </table>
            {insights.sleep.alerts.length > 0 && (
              <div className="mt-2 space-y-1">
                {insights.sleep.alerts.map((a, i) => (
                  <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    {a.title}
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* Mood Summary */}
          <Card>
            <h2 className="mb-2 text-sm font-semibold">Humor</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-muted">Tendência</td>
                  <td className="py-1 text-right font-medium">
                    {insights.mood.moodTrend === "up"
                      ? "Subindo"
                      : insights.mood.moodTrend === "down"
                        ? "Caindo"
                        : insights.mood.moodTrend === "stable"
                          ? "Estável"
                          : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">Oscilação</td>
                  <td className="py-1 text-right font-medium">
                    {insights.mood.moodAmplitudeLabel ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-muted">Medicação</td>
                  <td className="py-1 text-right font-medium">
                    {insights.mood.medicationAdherence !== null
                      ? `${insights.mood.medicationAdherence}%`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
            {insights.mood.topWarningSigns.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted">Sinais:</p>
                {insights.mood.topWarningSigns.map((s) => (
                  <span
                    key={s.key}
                    className="mr-1 inline-block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                  >
                    {s.label} ({s.count}x)
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* SOS Events */}
        {report.sosEvents.length > 0 && (
          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
              Eventos SOS ({report.sosEvents.length})
            </h2>
            <div className="space-y-1">
              {report.sosEvents.map((e, i) => (
                <p key={i} className="text-xs text-muted">
                  {formatDate(e.date)} — {e.action}
                </p>
              ))}
            </div>
          </Card>
        )}

        {/* Weekly Assessments (STEP-BD style) */}
        {report.weeklyAssessments && report.weeklyAssessments.length > 0 && (
          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">
              Avaliações Semanais — ASRM / PHQ-9 / FAST
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left">Semana</th>
                    <th className="px-2 py-1.5 text-center">ASRM</th>
                    <th className="px-2 py-1.5 text-center">PHQ-9</th>
                    <th className="px-2 py-1.5 text-center">Item 9</th>
                    <th className="px-2 py-1.5 text-center">FAST</th>
                    <th className="px-2 py-1.5 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {report.weeklyAssessments.map((a) => (
                    <tr key={a.date} className="border-t border-border">
                      <td className="px-2 py-1">{a.date}</td>
                      <td className={`px-2 py-1 text-center font-medium ${
                        a.asrmTotal !== null && a.asrmTotal >= 6
                          ? "text-amber-700 dark:text-amber-400"
                          : ""
                      }`}>
                        {a.asrmTotal ?? "—"}
                      </td>
                      <td className={`px-2 py-1 text-center font-medium ${
                        a.phq9Total !== null && a.phq9Total >= 15
                          ? "text-red-700 dark:text-red-400"
                          : a.phq9Total !== null && a.phq9Total >= 10
                            ? "text-amber-700 dark:text-amber-400"
                            : ""
                      }`}>
                        {a.phq9Total ?? "—"}
                      </td>
                      <td className={`px-2 py-1 text-center ${
                        a.phq9Item9 !== null && a.phq9Item9 >= 1
                          ? "font-bold text-red-700 dark:text-red-400"
                          : ""
                      }`}>
                        {a.phq9Item9 ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {a.fastAvg ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-muted">
                        {a.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-muted">
              ASRM ≥6 = possível hipomania. PHQ-9: 5-9 leve, 10-14 moderado, 15-19 mod-severo, 20+ severo. Item 9 = ideação.
            </p>
          </Card>
        )}

        {/* Life Chart Events */}
        {report.lifeChartEvents && report.lifeChartEvents.length > 0 && (
          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">
              Life Chart — Eventos ({report.lifeChartEvents.length})
            </h2>
            <div className="space-y-1">
              {report.lifeChartEvents.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="flex-shrink-0 font-medium">{e.date}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] dark:bg-gray-800">
                    {e.eventType}
                  </span>
                  <span className="text-muted">{e.label}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Raw Data Tables */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">
            Dados Brutos — Check-ins ({rawData.entries.length} registros)
          </h2>
          {rawData.entries.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left">Data</th>
                    <th className="px-2 py-1.5 text-center">Humor</th>
                    <th className="px-2 py-1.5 text-center">Energia</th>
                    <th className="px-2 py-1.5 text-center">Ansied.</th>
                    <th className="px-2 py-1.5 text-center">Irrit.</th>
                    <th className="px-2 py-1.5 text-center">Med.</th>
                    <th className="px-2 py-1.5 text-left">Sinais</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.entries.map((e) => (
                    <tr key={e.date} className="border-t border-border">
                      <td className="px-2 py-1">{e.date}</td>
                      <td className="px-2 py-1 text-center">{e.mood}</td>
                      <td className="px-2 py-1 text-center">{e.energy ?? "—"}</td>
                      <td className="px-2 py-1 text-center">{e.anxiety ?? "—"}</td>
                      <td className="px-2 py-1 text-center">{e.irritability ?? "—"}</td>
                      <td className="px-2 py-1 text-center">{e.medication ?? "—"}</td>
                      <td className="px-2 py-1 text-muted">
                        {(() => {
                          if (!e.warningSigns) return "—";
                          try {
                            const parsed = JSON.parse(e.warningSigns);
                            return Array.isArray(parsed) ? parsed.join(", ") : "—";
                          } catch { return "—"; }
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold">
            Dados Brutos — Sono ({rawData.sleepLogs.length} registros)
          </h2>
          {rawData.sleepLogs.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-2 py-1.5 text-left">Data</th>
                    <th className="px-2 py-1.5 text-center">Dormir</th>
                    <th className="px-2 py-1.5 text-center">Acordar</th>
                    <th className="px-2 py-1.5 text-center">Total</th>
                    <th className="px-2 py-1.5 text-center">Qualidade</th>
                    <th className="px-2 py-1.5 text-center">HRV</th>
                    <th className="px-2 py-1.5 text-center">FC</th>
                  </tr>
                </thead>
                <tbody>
                  {rawData.sleepLogs.map((l) => (
                    <tr key={l.date} className="border-t border-border">
                      <td className="px-2 py-1">{l.date}</td>
                      <td className="px-2 py-1 text-center">{l.bedtime}</td>
                      <td className="px-2 py-1 text-center">{l.wakeTime}</td>
                      <td className="px-2 py-1 text-center">
                        {formatDuration(l.totalHours)}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {l.quality > 0 ? `${l.quality}%` : "—"}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {l.hrv ?? "—"}
                      </td>
                      <td className="px-2 py-1 text-center">
                        {l.heartRate ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Medications */}
        {report.medications && (
          <Card className="mt-4">
            <h2 className="mb-2 text-sm font-semibold">Medicações (do Plano de Crise)</h2>
            <p className="text-sm text-muted">
              {(() => {
                try {
                  return JSON.parse(report.medications).join(", ");
                } catch {
                  return report.medications;
                }
              })()}
            </p>
          </Card>
        )}

        <p className="mt-6 text-center text-[10px] text-muted">
          Dados gerados automaticamente pela Suporte Bipolar.
          Indicadores heurísticos educacionais — uso clínico requer interpretação profissional.
          Paciente autorizou compartilhamento conforme a LGPD e termos de consentimento aplicáveis.
        </p>
      </div>
    </div>
  );
}
