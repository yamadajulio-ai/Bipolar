"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { CATEGORY_COLORS, GOOGLE_EVENT_COLORS } from "@/lib/planner/categories";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { expandSerializedBlocks } from "@/lib/planner/expandClient";
import type { SerializedBlock } from "@/lib/planner/expandClient";
import type { ExpandedOccurrence, StabilityAlert } from "@/lib/planner/types";
import Link from "next/link";

interface WeeklyViewProps {
  initialWeekStart: string; // YYYY-MM-DD (Monday)
}

const WEEKDAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function formatTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

// ── Overlap layout algorithm (Google Calendar style) ──────────────

interface LayoutBlock {
  occ: ExpandedOccurrence;
  col: number;
  totalCols: number;
}

function computeOverlapLayout(occs: ExpandedOccurrence[]): LayoutBlock[] {
  if (occs.length === 0) return [];

  const sorted = [...occs].sort((a, b) => {
    const sa = new Date(a.startAt).getTime();
    const sb = new Date(b.startAt).getTime();
    if (sa !== sb) return sa - sb;
    return new Date(b.endAt).getTime() - new Date(a.endAt).getTime();
  });

  const result: LayoutBlock[] = [];
  let groupStart = 0;

  while (groupStart < sorted.length) {
    let groupEnd = groupStart;
    let maxEnd = new Date(sorted[groupStart].endAt).getTime();

    while (groupEnd + 1 < sorted.length && new Date(sorted[groupEnd + 1].startAt).getTime() < maxEnd) {
      groupEnd++;
      maxEnd = Math.max(maxEnd, new Date(sorted[groupEnd].endAt).getTime());
    }

    const columns: number[] = [];
    const groupItems: { occ: ExpandedOccurrence; col: number }[] = [];

    for (let i = groupStart; i <= groupEnd; i++) {
      const start = new Date(sorted[i].startAt).getTime();
      let col = 0;
      while (col < columns.length && columns[col] > start) {
        col++;
      }
      if (col >= columns.length) {
        columns.push(0);
      }
      columns[col] = new Date(sorted[i].endAt).getTime();
      groupItems.push({ occ: sorted[i], col });
    }

    const totalCols = columns.length;
    for (const item of groupItems) {
      result.push({ occ: item.occ, col: item.col, totalCols });
    }

    groupStart = groupEnd + 1;
  }

  return result;
}

// ── Main component ────────────────────────────────────────────────

export function WeeklyView({ initialWeekStart }: WeeklyViewProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [occurrences, setOccurrences] = useState<ExpandedOccurrence[]>([]);
  const [alerts, setAlerts] = useState<StabilityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  const didAutoSync = useRef(false);

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (start: string, signal?: AbortSignal) => {
    setLoading(true);
    setFetchError(null);
    try {
      const end = addDays(start, 6);
      const res = await fetch(
        `/api/planner/blocks?timeMin=${start}T00:00:00&timeMax=${end}T23:59:59`,
        { signal },
      );
      if (!res.ok) throw new Error("Fetch failed");
      const data: SerializedBlock[] = await res.json();

      const expanded = expandSerializedBlocks(data, new Date(start + "T00:00:00"), new Date(end + "T23:59:59"));
      setOccurrences(expanded);

      const rulesRes = await fetch("/api/planner/rules", { signal });
      if (rulesRes.ok) {
        const rules = await rulesRes.json();
        const weekOccs = expanded.filter((o) => o.occurrenceDate >= start && o.occurrenceDate <= end);
        const constraintAlerts = checkConstraintsClient(weekOccs, rules);
        setAlerts(constraintAlerts);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setFetchError("Erro ao carregar agenda. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-sync from Google Calendar on mount
  // Strategy: show existing blocks immediately, sync in background, refresh after
  useEffect(() => {
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);

    async function autoSync() {
      if (didAutoSync.current) return;
      didAutoSync.current = true;

      // 1. Show existing blocks immediately (no waiting for sync)
      await fetchData(weekStart, controller.signal);

      // 2. Check if Google is connected and sync in background
      try {
        const res = await fetch("/api/google/sync", { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(data.connected);

          if (data.connected) {
            setSyncing(true);
            setSyncError(null);
            try {
              const syncController = new AbortController();
              const syncTimeout = setTimeout(() => syncController.abort(), 15000);
              const syncRes = await fetch("/api/google/sync", {
                method: "POST",
                signal: syncController.signal,
              });
              clearTimeout(syncTimeout);
              if (!syncRes.ok) {
                const errData = await syncRes.json().catch(() => ({}));
                setSyncError(errData.error || `Erro ${syncRes.status}`);
              } else {
                // Refresh blocks after successful sync
                await fetchData(weekStart, controller.signal);
              }
            } catch {
              // sync failure or timeout is non-blocking
            } finally {
              setSyncing(false);
            }
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setGoogleConnected(false);
      }
    }
    autoSync().finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh: re-sync Google Calendar every 5 minutes while page is open
  useEffect(() => {
    if (googleConnected !== true) return;
    const INTERVAL = 5 * 60_000; // 5 minutes
    const id = setInterval(async () => {
      try {
        await fetch("/api/google/sync", { method: "POST" });
        await fetchData(weekStart);
      } catch {
        // non-blocking
      }
    }, INTERVAL);
    return () => clearInterval(id);
  }, [googleConnected, weekStart, fetchData]);

  // Fetch data when week changes (after initial load)
  useEffect(() => {
    if (didAutoSync.current) {
      fetchData(weekStart);
    }
  }, [weekStart, fetchData]);

  // Scroll to 7am on first load
  useEffect(() => {
    if (!loading && scrollRef.current && !didScroll.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
      didScroll.current = true;
    }
  }, [loading]);

  function navigateWeek(dir: number) {
    setWeekStart(addDays(weekStart, dir * 7));
  }

  function goToToday() {
    setWeekStart(getMonday(localToday()));
  }

  async function handleManualSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      // Full sync resets syncToken to re-import all events
      const res = await fetch("/api/google/sync?full=1", { method: "POST" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSyncError(errData.error || `Erro ${res.status}`);
      } else {
        const result = await res.json();
        setSyncError(null);
        // Show result info
        if (result.pulled === 0 && result.errors === 0) {
          const skipped = (result.skippedAllDay || 0) + (result.skippedLong || 0);
          if (skipped > 0) {
            setSyncError(`Nenhum evento importado. ${skipped} evento(s) ignorado(s) (dia inteiro ou muito longo). Verifique se seus eventos têm horário definido.`);
          } else {
            setSyncError("Nenhum evento encontrado no Google Agenda no período (última semana + próximas 2 semanas).");
          }
        }
        await fetchData(weekStart);
      }
    } catch {
      setSyncError("Falha de conexão ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  function getOccsForDay(dayStr: string): ExpandedOccurrence[] {
    return occurrences.filter((o) => o.occurrenceDate === dayStr);
  }

  const today = localToday();

  // Now indicator
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowTop = nowHour * HOUR_HEIGHT;

  return (
    <div>
      {/* Banner: connect Google Calendar */}
      {googleConnected === false && (
        <Link
          href="/integracoes"
          className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 no-underline transition-colors hover:bg-amber-100"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">Conecte seu Google Agenda</p>
            <p className="text-xs text-amber-600">Seus eventos aparecerão automaticamente no planejador.</p>
          </div>
        </Link>
      )}

      {/* Syncing indicator */}
      {syncing && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
          <svg className="h-4 w-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-blue-700">Sincronizando com Google Agenda...</span>
        </div>
      )}

      {/* Sync error */}
      {syncError && !syncing && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5" role="alert">
          <p className="text-sm text-red-700">{syncError}</p>
          <button
            onClick={handleManualSync}
            className="mt-1 text-xs font-medium text-red-600 underline hover:text-red-800"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => navigateWeek(-1)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:border-primary/50"
        >
          &larr; Anterior
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {formatDateBR(weekStart)} — {formatDateBR(weekEnd)}
          </span>
          <button
            onClick={goToToday}
            className="rounded-lg border border-primary/50 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            Hoje
          </button>
          {googleConnected && (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted hover:border-primary/50 disabled:opacity-50"
              title="Sincronizar Google Agenda"
            >
              {syncing ? "..." : "\u21BB"}
            </button>
          )}
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:border-primary/50"
        >
          Próximo &rarr;
        </button>
      </div>

      {/* Week-level alerts */}
      {alerts.filter((a) => a.type === "max_late_nights").map((a, i) => (
        <Alert key={i} variant="warning" className="mb-3">
          {a.message} Este alerta é automático e não substitui avaliação profissional.
        </Alert>
      ))}

      {fetchError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-700">{fetchError}</p>
          <button
            onClick={() => {
              const controller = new AbortController();
              fetchAbortRef.current = controller;
              const timeout = setTimeout(() => controller.abort(), 30000);
              fetchData(weekStart, controller.signal).finally(() => clearTimeout(timeout));
            }}
            className="mt-2 text-sm text-red-600 underline hover:text-red-800"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <Card>
          <p className="text-center text-muted py-4">Carregando...</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Day headers */}
          <div className="flex border-b border-border bg-surface">
            <div className="w-12 flex-shrink-0" />
            {days.map((day, i) => {
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={`flex-1 border-l border-border px-1 py-2 text-center ${isToday ? "bg-primary/5" : ""}`}
                >
                  <div className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted"}`}>
                    {WEEKDAY_NAMES[i]}
                  </div>
                  <div
                    className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                      isToday ? "bg-primary text-white" : "text-foreground"
                    }`}
                  >
                    {day.slice(8)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid (scrollable) */}
          <div
            ref={scrollRef}
            className="overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: "70vh" }}
          >
            <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
              {/* Hour labels */}
              <div className="w-12 flex-shrink-0 relative">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute right-1 text-[10px] text-muted leading-none"
                    style={{ top: h * HOUR_HEIGHT - 5 }}
                  >
                    {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day) => {
                const isToday = day === today;
                const dayOccs = getOccsForDay(day);
                const layout = computeOverlapLayout(dayOccs);

                return (
                  <div
                    key={day}
                    className={`flex-1 border-l border-border relative ${isToday ? "bg-primary/[0.02]" : ""}`}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t border-border/30"
                        style={{ top: h * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* "Now" indicator */}
                    {isToday && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: nowTop }}
                      >
                        <div className="flex items-center">
                          <div className="h-2.5 w-2.5 -ml-[5px] rounded-full bg-red-500" />
                          <div className="flex-1 h-[2px] bg-red-500" />
                        </div>
                      </div>
                    )}

                    {/* Blocks (read-only) */}
                    {layout.map((lb, k) => {
                      const startH = new Date(lb.occ.startAt).getHours() + new Date(lb.occ.startAt).getMinutes() / 60;
                      let endH = new Date(lb.occ.endAt).getHours() + new Date(lb.occ.endAt).getMinutes() / 60;
                      if (endH <= startH) endH = 24;

                      const top = startH * HOUR_HEIGHT;
                      const height = Math.max((endH - startH) * HOUR_HEIGHT, 18);
                      const leftPct = (lb.col / lb.totalCols) * 100;
                      const widthPct = (1 / lb.totalCols) * 100;
                      const gColor = lb.occ.googleColor ? GOOGLE_EVENT_COLORS[lb.occ.googleColor] : null;
                      const categoryClasses = !gColor ? (CATEGORY_COLORS[lb.occ.category] || CATEGORY_COLORS.outro) : "";
                      const isShort = height < 36;

                      return (
                        <div
                          key={k}
                          className={`absolute z-10 overflow-hidden rounded border text-left ${categoryClasses}`}
                          style={{
                            top,
                            height,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 2px)`,
                            marginLeft: 1,
                            ...(gColor ? { backgroundColor: gColor.bg, borderColor: gColor.border, color: gColor.text } : {}),
                          }}
                          title={`${lb.occ.title}\n${formatTime(lb.occ.startAt)} - ${formatTime(lb.occ.endAt)}`}
                        >
                          {isShort ? (
                            <div className="px-1 py-0.5 text-[9px] leading-tight truncate">
                              <span className="font-semibold">{lb.occ.title}</span>
                            </div>
                          ) : (
                            <div className="px-1.5 py-1">
                              <div className="text-[10px] font-semibold leading-tight truncate">
                                {lb.occ.title}
                                {lb.occ.kind === "ANCHOR" && <span className="ml-0.5 opacity-60">⚓</span>}
                              </div>
                              <div className="text-[9px] opacity-75 leading-tight">
                                {formatTime(lb.occ.startAt)} – {formatTime(lb.occ.endAt)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && occurrences.length === 0 && googleConnected && (
        <div className="mt-4 text-center text-sm text-muted">
          <p>Nenhum evento nesta semana.</p>
          <p className="mt-1">Crie eventos no Google Agenda e eles aparecerão aqui automaticamente.</p>
        </div>
      )}
    </div>
  );
}

// ── Client-side helpers ────────────────────────────────────────────

function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function checkConstraintsClient(
  occs: ExpandedOccurrence[],
  rules: { lateEventCutoffMin: number; windDownMin: number; maxLateNightsPerWeek: number; protectAnchors: boolean; targetSleepTimeMin: number | null },
): StabilityAlert[] {
  const alerts: StabilityAlert[] = [];
  const byDay = new Map<string, ExpandedOccurrence[]>();

  for (const occ of occs) {
    const ymd = occ.occurrenceDate;
    if (!byDay.has(ymd)) byDay.set(ymd, []);
    byDay.get(ymd)!.push(occ);
  }

  const lateNightDates: string[] = [];

  for (const [date, dayOccs] of byDay) {
    const sorted = [...dayOccs].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    for (const occ of sorted) {
      const endDate = new Date(occ.endAt);
      const endMin = endDate.getHours() * 60 + endDate.getMinutes();
      const isLate = endMin > rules.lateEventCutoffMin || (endMin < 360 && endMin > 0);
      if (isLate && occ.kind !== "ANCHOR") {
        if (!lateNightDates.includes(date)) lateNightDates.push(date);
      }
    }
  }

  if (lateNightDates.length > rules.maxLateNightsPerWeek) {
    alerts.push({
      type: "max_late_nights",
      severity: "warning",
      message: `${lateNightDates.length} noites tardias nesta semana (limite: ${rules.maxLateNightsPerWeek}).`,
      date: lateNightDates[0],
      blockIds: [],
    });
  }

  return alerts;
}
