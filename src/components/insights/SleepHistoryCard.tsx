"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SleepLog {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalHours: number;
  awakeMinutes: number;
  hrv: number | null;
  heartRate: number | null;
  excluded: boolean;
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

export function SleepHistoryCard({ log }: { log: SleepLog }) {
  const [excluded, setExcluded] = useState(log.excluded);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  const isNap = log.totalHours < 1;
  const isCritical = !isNap && log.totalHours < 5;   // < 5h → vermelho
  const isShort = !isNap && log.totalHours >= 5 && log.totalHours < 6; // 5-6h → âmbar
  const isOk = !isNap && log.totalHours >= 6 && log.totalHours < 7;   // 6-7h → neutro
  const isGood = log.totalHours >= 7;                                   // >= 7h → verde
  const isSuspect = !isNap && log.totalHours >= 1 && log.totalHours < 4.5;

  // Awake minutes: prefer DB field, fallback to computed from bed-to-wake span
  const inBedHours = bedToWakeHours(log.bedtime, log.wakeTime);
  const awakeMinutes = log.awakeMinutes > 0
    ? log.awakeMinutes
    : inBedHours !== null
      ? Math.max(0, Math.round((inBedHours - log.totalHours) * 60))
      : 0;
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

  // Color bands: <1h purple (nap) | <5h red | 5-6h amber | 6-7h neutral | >=7h green
  const borderColor = excluded
    ? "border-border bg-surface-alt/50 opacity-60"
    : isNap
      ? "border-purple-200 bg-purple-50/40"
      : isCritical
        ? "border-red-200 bg-red-50/50"
        : isShort
          ? "border-amber-200 bg-amber-50/40"
          : isGood
            ? "border-emerald-200/50 bg-emerald-50/30"
            : "border-border bg-surface";

  const durationColor = excluded
    ? "text-muted line-through"
    : isNap ? "text-purple-600"
      : isCritical ? "text-red-600"
        : isShort ? "text-amber-600"
          : isGood ? "text-emerald-700"
            : "text-foreground";

  const barColor = excluded
    ? "bg-border"
    : isNap ? "bg-purple-400"
      : isCritical ? "bg-red-400"
        : isShort ? "bg-amber-400"
          : isGood ? "bg-emerald-400"
            : "bg-amber-300";

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
            <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-muted">
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
        <div className="flex flex-col">
          <span>{log.bedtime} → {log.wakeTime}</span>
          {awakeMinutes >= 2 && (
            <span className="text-[10px] text-muted/70">
              {awakeMinutes}min acordado (relógio)
            </span>
          )}
        </div>
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
              : "bg-surface-alt text-muted hover:bg-border"
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
