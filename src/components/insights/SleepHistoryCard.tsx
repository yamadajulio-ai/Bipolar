"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  awakeMinutes: number;
  hrv: number | null;
  heartRate: number | null;
  excluded: boolean;
  source?: string; // "manual" | "hae" | "health_connect" | "unknown_legacy"
  fieldProvenance?: string | null; // JSONB string
  perceivedQuality?: number | null;
}

/** Derive combined source labels from fieldProvenance */
function sourceLabels(source?: string, fieldProvenance?: string | null): { text: string; className: string }[] {
  const labels: { text: string; className: string }[] = [];

  // Check fieldProvenance for combined sources
  if (fieldProvenance) {
    try {
      const fp = JSON.parse(fieldProvenance) as Record<string, string>;
      const sources = new Set(Object.values(fp).filter(Boolean));
      if (sources.has("hae") || sources.has("health_connect")) {
        const wearableType = sources.has("hae") ? "Apple Watch" : "Android";
        const cls = sources.has("hae")
          ? "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
          : "bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300";
        labels.push({ text: wearableType, className: cls });
      }
      if (sources.has("manual")) {
        labels.push({ text: "Manual", className: "bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300" });
      }
      if (labels.length > 0) return labels;
    } catch { /* fall through to source-based */ }
  }

  // Fallback: single source
  if (!source || source === "manual" || source === "unknown_legacy") return labels;
  if (source === "hae") labels.push({ text: "Apple Watch", className: "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300" });
  if (source === "health_connect") labels.push({ text: "Android", className: "bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300" });
  return labels;
}

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

/** Compute raw bed-to-wake span in hours */
function bedToWakeHours(bedtime: string, wakeTime: string): number | null {
  const [bH, bM] = bedtime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  if (isNaN(bH) || isNaN(bM) || isNaN(wH) || isNaN(wM)) return null;
  let bedMin = bH * 60 + bM;
  let wakeMin = wH * 60 + wM;
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  return (wakeMin - bedMin) / 60;
}

function getColorClasses(totalHours: number, excluded: boolean) {
  const isNap = totalHours < 1;
  const isCritical = !isNap && totalHours < 5;
  const isShort = !isNap && totalHours >= 5 && totalHours < 6;
  const isGood = totalHours >= 7;

  const borderColor = excluded
    ? "border-border bg-surface-alt/50 opacity-60"
    : isNap
      ? "border-purple-200 dark:border-purple-800 bg-purple-50/40 dark:bg-purple-950/40"
      : isCritical
        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/40"
        : isShort
          ? "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/40"
          : isGood
            ? "border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-950/30"
            : "border-border bg-surface";

  const durationColor = excluded
    ? "text-muted line-through"
    : isNap ? "text-purple-600 dark:text-purple-400"
      : isCritical ? "text-red-600 dark:text-red-400"
        : isShort ? "text-amber-600 dark:text-amber-400"
          : isGood ? "text-emerald-700 dark:text-emerald-400"
            : "text-foreground";

  const barColor = excluded
    ? "bg-border"
    : isNap ? "bg-purple-400"
      : isCritical ? "bg-red-400"
        : isShort ? "bg-amber-400"
          : isGood ? "bg-emerald-400"
            : "bg-amber-300";

  return { borderColor, durationColor, barColor, isNap };
}

/** Groups logs by date and renders day totals + individual cycles */
export function SleepDayGroup({ logs }: { logs: SleepLog[] }) {
  if (logs.length === 0) return null;

  // Group by date (already sorted desc from parent)
  const grouped = new Map<string, SleepLog[]>();
  for (const log of logs) {
    const existing = grouped.get(log.date) ?? [];
    existing.push(log);
    grouped.set(log.date, existing);
  }

  return (
    <div className="space-y-2">
      {Array.from(grouped.entries()).map(([date, dayLogs]) => {
        const dateObj = new Date(date + "T12:00:00");
        const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
        const dateLabel = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        const hasMultiple = dayLogs.length > 1;
        const dayTotal = dayLogs.reduce((sum, l) => sum + l.totalHours, 0);
        const { borderColor, durationColor } = getColorClasses(dayTotal, false);

        if (!hasMultiple) {
          // Single log: render classic card
          return <SleepHistoryCard key={dayLogs[0].id} log={dayLogs[0]} />;
        }

        // Multiple cycles: render grouped card
        return (
          <div key={date} className={`rounded-lg border p-3 ${borderColor}`}>
            {/* Day header with total */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium capitalize">{weekday}</span>
                <span className="text-xs text-muted">{dateLabel}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {dayLogs.length} ciclos
                </span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold tabular-nums ${durationColor}`}>
                  {formatSleepDuration(dayTotal)}
                </span>
                <p className="text-[10px] text-muted">total do dia</p>
              </div>
            </div>

            {/* Individual cycles */}
            <div className="space-y-1.5 border-t border-border/50 pt-2">
              {dayLogs.map((log, i) => (
                <SleepCycleRow key={log.id} log={log} index={i + 1} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact row for a single cycle within a multi-cycle day */
function SleepCycleRow({ log, index }: { log: SleepLog; index: number }) {
  const [excluded, setExcluded] = useState(log.excluded);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  const isNap = log.totalHours < 1;
  const isSuspect = !isNap && log.totalHours >= 1 && log.totalHours < 4.5;
  const { durationColor, barColor } = getColorClasses(log.totalHours, excluded);
  const durationPct = Math.min(100, Math.max(8, (log.totalHours / 10) * 100));

  const inBedHours = bedToWakeHours(log.bedtime, log.wakeTime);
  const awakeMinutes = log.awakeMinutes > 0
    ? log.awakeMinutes
    : inBedHours !== null
      ? Math.max(0, Math.round((inBedHours - log.totalHours) * 60))
      : 0;

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch("/api/sono/excluir", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, excluded: !excluded }),
      });
      if (res.ok) {
        setExcluded(!excluded);
        router.refresh();
      }
    } catch { /* silently fail */ } finally {
      setToggling(false);
    }
  }

  return (
    <div className={`rounded-md border border-border/40 p-2 ${excluded ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-muted">Ciclo {index}</span>
          {isNap && !excluded && (
            <span className="rounded-full bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 text-[9px] font-medium text-purple-700 dark:text-purple-300">cochilo</span>
          )}
          {excluded && (
            <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-medium text-muted">excluído</span>
          )}
          {isSuspect && !excluded && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-300">incompleto?</span>
          )}
          {sourceLabels(log.source, log.fieldProvenance).map((s) => <span key={s.text} className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${s.className}`}>{s.text}</span>)}
        </div>
        <span className={`text-xs font-bold tabular-nums ${durationColor}`}>
          {formatSleepDuration(log.totalHours)}
        </span>
      </div>

      <div className="h-1 w-full rounded-full bg-black/10 dark:bg-white/10 mb-1">
        <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${durationPct}%` }} />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted">
        <div className="flex flex-col">
          <span>{log.bedtime} → {log.wakeTime}</span>
          {awakeMinutes >= 30 && inBedHours !== null ? (
            <span className="text-[9px] text-muted/70">
              Na cama: {formatSleepDuration(inBedHours)} · Dormiu: {formatSleepDuration(Math.max(0, log.totalHours - awakeMinutes / 60))} · {awakeMinutes}min acordado
            </span>
          ) : awakeMinutes >= 2 ? (
            <span className="text-[9px] text-muted/70">{awakeMinutes}min acordado (relógio)</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {log.hrv != null && <span>HRV <strong className="text-foreground">{log.hrv}</strong>ms</span>}
          {log.heartRate != null && <span>FC <strong className="text-foreground">{log.heartRate}</strong>bpm</span>}
        </div>
      </div>

      {!isNap && (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`mt-1.5 w-full rounded-md px-2 py-0.5 text-[10px] transition-colors ${
            excluded ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-surface-alt text-muted hover:bg-border"
          } disabled:opacity-50`}
        >
          {toggling ? "..." : excluded ? "Incluir nas métricas" : "Excluir das métricas (registro incompleto)"}
        </button>
      )}
    </div>
  );
}

/** Single sleep log card (used when only 1 cycle in a day) */
export function SleepHistoryCard({ log }: { log: SleepLog }) {
  const [excluded, setExcluded] = useState(log.excluded);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  const isNap = log.totalHours < 1;
  const isSuspect = !isNap && log.totalHours >= 1 && log.totalHours < 4.5;
  const { borderColor, durationColor, barColor } = getColorClasses(log.totalHours, excluded);
  const durationPct = Math.min(100, Math.max(8, (log.totalHours / 10) * 100));
  const dateObj = new Date(log.date + "T12:00:00");
  const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
  const dateLabel = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const inBedHours = bedToWakeHours(log.bedtime, log.wakeTime);
  const awakeMinutes = log.awakeMinutes > 0
    ? log.awakeMinutes
    : inBedHours !== null
      ? Math.max(0, Math.round((inBedHours - log.totalHours) * 60))
      : 0;

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch("/api/sono/excluir", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: log.id, excluded: !excluded }),
      });
      if (res.ok) {
        setExcluded(!excluded);
        router.refresh();
      }
    } catch { /* silently fail */ } finally {
      setToggling(false);
    }
  }

  return (
    <div className={`rounded-lg border p-3 ${borderColor} transition-opacity`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium capitalize">{weekday}</span>
          <span className="text-xs text-muted">{dateLabel}</span>
          {isNap && !excluded && (
            <span className="rounded-full bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">cochilo</span>
          )}
          {excluded && (
            <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted">excluído</span>
          )}
          {isSuspect && !excluded && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">incompleto?</span>
          )}
          {sourceLabels(log.source, log.fieldProvenance).map((s) => <span key={s.text} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${s.className}`}>{s.text}</span>)}
        </div>
        <span className={`text-sm font-bold tabular-nums ${durationColor}`}>
          {formatSleepDuration(log.totalHours)}
        </span>
      </div>

      <div className="h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 mb-1.5">
        <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${durationPct}%` }} />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <div className="flex flex-col">
          <span>{log.bedtime} → {log.wakeTime}</span>
          {awakeMinutes >= 30 && inBedHours !== null ? (
            <span className="text-[10px] text-muted/70">
              Na cama: {formatSleepDuration(inBedHours)} · Dormiu: {formatSleepDuration(Math.max(0, log.totalHours - awakeMinutes / 60))} · {awakeMinutes}min acordado
            </span>
          ) : awakeMinutes >= 2 ? (
            <span className="text-[10px] text-muted/70">{awakeMinutes}min acordado (relógio)</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {log.hrv != null && <span>HRV <strong className="text-foreground">{log.hrv}</strong>ms</span>}
          {log.heartRate != null && <span>FC <strong className="text-foreground">{log.heartRate}</strong>bpm</span>}
        </div>
      </div>

      {!isNap && (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`mt-2 w-full rounded-md px-2 py-1 text-[11px] transition-colors ${
            excluded ? "bg-primary/10 text-primary hover:bg-primary/20" : "bg-surface-alt text-muted hover:bg-border"
          } disabled:opacity-50`}
        >
          {toggling ? "..." : excluded ? "Incluir nas métricas" : "Excluir das métricas (registro incompleto)"}
        </button>
      )}
    </div>
  );
}
