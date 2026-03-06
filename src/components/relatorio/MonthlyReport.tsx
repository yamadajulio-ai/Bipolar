"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { MOOD_LABELS, WARNING_SIGNS, LIFE_CHART_EVENT_TYPES } from "@/lib/constants";

interface ReportData {
  month: string;
  stats: {
    totalDiaryEntries: number;
    totalSleepLogs: number;
    totalExercises: number;
    totalRhythms: number;
    avgMood: number | null;
    avgSleep: number | null;
    avgEnergy: number | null;
    avgAnxiety: number | null;
    avgSleepQuality: number | null;
    moodDistribution: Record<number, number>;
    medicationAdherence: number | null;
    warningSignsFreq: Record<string, number>;
    totalWeeklyAssessments?: number;
    avgAsrm?: number | null;
    avgPhq9?: number | null;
    avgFunctioning?: number | null;
    totalLifeChartEvents?: number;
    eventTypeCounts?: Record<string, number>;
  };
  entries: Array<{ date: string; mood: number; sleepHours: number }>;
  sleepLogs: Array<{ date: string; totalHours: number; quality: number }>;
  weeklyAssessments?: Array<{ date: string; asrmTotal: number | null; phq9Total: number | null; fastAvg: number | null }>;
  lifeChartEvents?: Array<{ date: string; eventType: string; label: string }>;
}

interface MonthlyReportProps {
  data: ReportData;
}

export function MonthlyReport({ data }: MonthlyReportProps) {
  const { stats, entries } = data;

  const moodDistData = [1, 2, 3, 4, 5].map((level) => ({
    name: MOOD_LABELS[level],
    count: stats.moodDistribution[level] || 0,
  }));

  const trendData = entries.map((e) => ({
    date: e.date.slice(8),
    mood: e.mood,
    sleep: e.sleepHours,
  }));

  const topWarnings = Object.entries(stats.warningSignsFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-8 print:space-y-4">
      {/* Header */}
      <div className="text-center print:mb-4">
        <h1 className="text-2xl font-bold text-foreground">Relatório Mensal</h1>
        <p className="text-muted">
          {new Date(data.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
        <p className="mt-2 text-xs text-muted print:text-[10px]">
          Gerado em {new Date().toLocaleDateString("pt-BR")} — Rede Bipolar
        </p>
        <p className="mt-1 text-xs text-warning print:text-[10px]">
          Este relatório é educacional e não substitui avaliação profissional.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        <StatCard label="Registros" value={stats.totalDiaryEntries} />
        <StatCard label="Humor médio" value={stats.avgMood ? `${stats.avgMood}/5` : "—"} />
        <StatCard label="Sono médio" value={stats.avgSleep ? `${stats.avgSleep}h` : "—"} />
        <StatCard label="Exercícios" value={stats.totalExercises} />
        {stats.avgEnergy && <StatCard label="Energia média" value={`${stats.avgEnergy}/5`} />}
        {stats.avgAnxiety && <StatCard label="Ansiedade média" value={`${stats.avgAnxiety}/5`} />}
        {stats.avgSleepQuality && <StatCard label="Qualidade sono" value={`${stats.avgSleepQuality}/5`} />}
        {stats.medicationAdherence !== null && (
          <StatCard label="Adesão medicação" value={`${stats.medicationAdherence}%`} />
        )}
        {stats.totalWeeklyAssessments ? <StatCard label="Avaliações semanais" value={stats.totalWeeklyAssessments} /> : null}
        {stats.avgAsrm !== null && stats.avgAsrm !== undefined && <StatCard label="ASRM médio" value={`${stats.avgAsrm}/20`} />}
        {stats.avgPhq9 !== null && stats.avgPhq9 !== undefined && <StatCard label="PHQ-9 médio" value={`${stats.avgPhq9}/27`} />}
        {stats.avgFunctioning !== null && stats.avgFunctioning !== undefined && <StatCard label="Funcionamento" value={`${stats.avgFunctioning}/5`} />}
      </div>

      {/* Mood & Sleep Trend */}
      {trendData.length >= 2 && (
        <div className="print:break-inside-avoid">
          <h2 className="mb-3 font-semibold text-foreground">Tendência de Humor e Sono</h2>
          <div className="h-52 print:h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="mood" domain={[1, 5]} tick={{ fontSize: 10 }} width={25} />
                <YAxis yAxisId="sleep" orientation="right" domain={[0, 14]} tick={{ fontSize: 10 }} width={25} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="#6366f1" strokeWidth={2} name="Humor" />
                <Line yAxisId="sleep" type="monotone" dataKey="sleep" stroke="#3b82f6" strokeWidth={2} name="Sono (h)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Mood Distribution */}
      <div className="print:break-inside-avoid">
        <h2 className="mb-3 font-semibold text-foreground">Distribuição de Humor</h2>
        <div className="h-40 print:h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moodDistData}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={25} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="count" fill="#6366f1" name="Dias" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Warning Signs */}
      {topWarnings.length > 0 && (
        <div className="print:break-inside-avoid">
          <h2 className="mb-3 font-semibold text-foreground">Sinais de Alerta Mais Frequentes</h2>
          <ul className="space-y-1">
            {topWarnings.map(([key, count]) => {
              const sign = WARNING_SIGNS.find((s) => s.key === key);
              return (
                <li key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                  <span>{sign?.label || key}</span>
                  <span className="font-medium text-muted">{count}x</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Weekly Assessments */}
      {data.weeklyAssessments && data.weeklyAssessments.length > 0 && (
        <div className="print:break-inside-avoid">
          <h2 className="mb-3 font-semibold text-foreground">Avaliações Semanais</h2>
          <div className="space-y-2">
            {data.weeklyAssessments.map((w) => (
              <div key={w.date} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-muted">{new Date(w.date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}</span>
                <div className="flex gap-3 text-xs">
                  {w.asrmTotal !== null && <span>ASRM: <strong>{w.asrmTotal}</strong></span>}
                  {w.phq9Total !== null && <span>PHQ-9: <strong>{w.phq9Total}</strong></span>}
                  {w.fastAvg !== null && <span>Func: <strong>{w.fastAvg.toFixed(1)}</strong></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Life Chart Events */}
      {data.lifeChartEvents && data.lifeChartEvents.length > 0 && (
        <div className="print:break-inside-avoid">
          <h2 className="mb-3 font-semibold text-foreground">Eventos Significativos</h2>
          <div className="space-y-2">
            {data.lifeChartEvents.map((e, i) => {
              const eventTypeLabel = LIFE_CHART_EVENT_TYPES.find((t) => t.key === e.eventType)?.label ?? e.eventType;
              return (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                  <span className="text-muted whitespace-nowrap">
                    {new Date(e.date + "T12:00:00Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}
                  </span>
                  <div>
                    <span className="text-xs text-muted">{eventTypeLabel}</span>
                    <p className="text-foreground">{e.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Print button (hidden in print) */}
      <div className="text-center print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
        >
          Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
