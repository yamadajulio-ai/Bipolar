"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  hrv: number | null;
  heartRate: number | null;
  excluded: boolean;
}

function formatSleepDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function SleepHistoryCard({ log }: { log: SleepLog }) {
  const [excluded, setExcluded] = useState(log.excluded);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  const isNap = log.totalHours < 1;
  const isShort = !isNap && log.totalHours < 6;
  const isGood = log.totalHours >= 7;
  const isSuspect = !isNap && log.totalHours >= 1 && log.totalHours < 4.5;
  const durationPct = Math.min(100, Math.max(8, (log.totalHours / 10) * 100));
  const dateObj = new Date(log.date + "T12:00:00");
  const weekday = dateObj.toLocaleDateString("pt-BR", { weekday: "short" });
  const dateLabel = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

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
    } catch {
      // silently fail
    } finally {
      setToggling(false);
    }
  }

  const borderColor = excluded
    ? "border-gray-200 bg-gray-50/50 opacity-60"
    : isNap
      ? "border-purple-200 bg-purple-50/40"
      : isShort
        ? "border-red-200 bg-red-50/50"
        : isGood
          ? "border-emerald-200/50 bg-emerald-50/30"
          : "border-border bg-surface";

  const durationColor = excluded
    ? "text-gray-400 line-through"
    : isNap ? "text-purple-600"
      : isShort ? "text-red-600"
        : isGood ? "text-emerald-700"
          : "text-foreground";

  const barColor = excluded
    ? "bg-gray-300"
    : isNap ? "bg-purple-400"
      : isShort ? "bg-red-400"
        : isGood ? "bg-emerald-400"
          : "bg-amber-400";

  return (
    <div className={`rounded-lg border p-3 ${borderColor} transition-opacity`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium capitalize">{weekday}</span>
          <span className="text-xs text-muted">{dateLabel}</span>
          {isNap && !excluded && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
              cochilo
            </span>
          )}
          {excluded && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              excluído
            </span>
          )}
          {isSuspect && !excluded && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              incompleto?
            </span>
          )}
        </div>
        <span className={`text-sm font-bold tabular-nums ${durationColor}`}>
          {formatSleepDuration(log.totalHours)}
        </span>
      </div>

      {/* Duration bar */}
      <div className="h-1.5 w-full rounded-full bg-black/10 mb-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${durationPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{log.bedtime} → {log.wakeTime}</span>
        <div className="flex items-center gap-3">
          {log.hrv != null && (
            <span>HRV <strong className="text-foreground">{log.hrv}</strong>ms</span>
          )}
          {log.heartRate != null && (
            <span>FC <strong className="text-foreground">{log.heartRate}</strong>bpm</span>
          )}
        </div>
      </div>

      {/* Exclude toggle — show for non-nap records */}
      {!isNap && (
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`mt-2 w-full rounded-md px-2 py-1 text-[11px] transition-colors ${
            excluded
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          {toggling
            ? "..."
            : excluded
              ? "Incluir nas métricas"
              : "Excluir das métricas (registro incompleto)"
          }
        </button>
      )}
    </div>
  );
}
