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
          Gerado em {new Date().toLocaleDateString("pt-BR")} — Suporte Bipolar
        </p>
        <p className="mt-1 text-xs text-warning print:text-[10px]">
          Este relatório é educacional e não substitui avaliação profissional.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        <StatCard label="Registros" value={stats.totalDiaryEntries} />
        <StatCard label="Humor médio" value={stats.avgMood ? `${stats.avgMood}/5` : "—"} subtitle="1=Muito baixo, 5=Muito elevado" />
        <StatCard label="Sono médio" value={stats.avgSleep ? `${stats.avgSleep}h` : "—"} subtitle="Horas por noite" />
        <StatCard label="Exercícios respiratórios" value={stats.totalExercises} subtitle="Sessões realizadas" />
        {stats.avgEnergy && <StatCard label="Disposição média" value={`${stats.avgEnergy}/5`} subtitle="1=Exausta, 5=Agitada" />}
        {stats.avgAnxiety && <StatCard label="Ansiedade média" value={`${stats.avgAnxiety}/5`} subtitle="1=Tranquila, 5=Intensa" />}
        {stats.avgSleepQuality && <StatCard label="Qualidade sono" value={`${stats.avgSleepQuality}/100`} subtitle="20=Péssima, 100=Ótima" />}
        {stats.medicationAdherence !== null && (
          <StatCard label="Adesão medicação" value={`${stats.medicationAdherence}%`} subtitle={`Dos ${stats.totalDiaryEntries} registro(s) feitos`} />
        )}
        {stats.totalWeeklyAssessments ? <StatCard label="Avaliações semanais" value={stats.totalWeeklyAssessments} /> : null}
        {stats.avgAsrm !== null && stats.avgAsrm !== undefined && <StatCard label="Mania (média)" value={`${stats.avgAsrm}/20`} />}
        {stats.avgPhq9 !== null && stats.avgPhq9 !== undefined && <StatCard label="Depressão (média)" value={`${stats.avgPhq9}/27`} />}
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
                <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="var(--color-primary, #527a6e)" strokeWidth={2} name="Humor" />
                <Line yAxisId="sleep" type="monotone" dataKey="sleep" stroke="var(--color-primary-light, #7da399)" strokeWidth={2} name="Sono (h)" />
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
              <Bar dataKey="count" fill="var(--color-primary, #527a6e)" name="Dias" radius={[4, 4, 0, 0]} />
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
                  {w.asrmTotal !== null && <span>Mania: <strong>{w.asrmTotal}</strong></span>}
                  {w.phq9Total !== null && <span>Depressão: <strong>{w.phq9Total}</strong></span>}
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

      {/* Topics for consultation */}
      <div className="print:break-inside-avoid rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
        <h2 className="mb-2 font-semibold text-foreground">Tópicos para discutir com o profissional</h2>
        <ul className="space-y-1 text-sm text-muted">
          {stats.avgMood !== null && stats.avgMood <= 2 && (
            <li>• Humor predominantemente baixo no mês (média {stats.avgMood}/5)</li>
          )}
          {stats.avgMood !== null && stats.avgMood >= 4 && (
            <li>• Humor predominantemente elevado no mês (média {stats.avgMood}/5)</li>
          )}
          {stats.avgSleep !== null && stats.avgSleep < 6 && (
            <li>• Sono abaixo de 6h em média — possível privação</li>
          )}
          {stats.avgSleep !== null && stats.avgSleep > 10 && (
            <li>• Sono acima de 10h em média — possível hipersonia</li>
          )}
          {stats.avgPhq9 !== undefined && stats.avgPhq9 !== null && stats.avgPhq9 >= 10 && (
            <li>• Pontuação de depressão média ≥ 10 — sintomas moderados a graves</li>
          )}
          {stats.avgAsrm !== undefined && stats.avgAsrm !== null && stats.avgAsrm >= 6 && (
            <li>• Pontuação de mania média ≥ 6 — possíveis sintomas maníacos/hipomaníacos</li>
          )}
          {stats.medicationAdherence !== null && stats.medicationAdherence < 70 && (
            <li>• Adesão à medicação abaixo de 70% — discutir barreiras</li>
          )}
          {topWarnings.length > 0 && (
            <li>• Sinais de alerta recorrentes: {topWarnings.slice(0, 3).map(([key]) => {
              const sign = WARNING_SIGNS.find((s) => s.key === key);
              return sign?.label || key;
            }).join(", ")}</li>
          )}
          {data.lifeChartEvents && data.lifeChartEvents.length > 0 && (
            <li>• {data.lifeChartEvents.length} evento(s) significativo(s) no período</li>
          )}
          {stats.totalDiaryEntries === 0 && (
            <li>• Nenhum registro de humor no mês — discutir motivação/barreiras</li>
          )}
          {stats.avgMood !== null && stats.avgMood > 2 && stats.avgMood < 4 && stats.totalDiaryEntries >= 7 && (
            <li>• Humor estável — manter acompanhamento</li>
          )}
        </ul>
        <p className="mt-3 text-[10px] text-muted italic">
          Estes tópicos são gerados automaticamente com base nos seus dados e têm caráter
          sugestivo. A interpretação clínica deve ser feita pelo profissional.
        </p>
      </div>

      {/* Print / Share buttons */}
      <div className="flex flex-wrap gap-3 justify-center print:hidden">
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
        >
          Salvar como PDF
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Meu relatório mensal de acompanhamento — ${new Date(data.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}. Gerado pelo Suporte Bipolar.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-6 py-2 text-sm font-medium text-white hover:bg-[#20BD5A]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </a>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={() => {
              navigator.share?.({
                title: `Relatório Mensal — ${data.month}`,
                text: `Relatório de acompanhamento bipolar — ${new Date(data.month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
              }).catch(() => {});
            }}
            className="rounded-lg border border-border px-6 py-2 text-sm text-muted hover:border-primary/50"
          >
            Compartilhar
          </button>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string | number; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted">{label}</p>
      {subtitle && <p className="mt-0.5 text-[10px] text-muted/70">{subtitle}</p>}
    </div>
  );
}
