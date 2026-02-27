"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { BlockEditorModal } from "./BlockEditorModal";
import { QuickAddInput } from "./QuickAddInput";
import { TemplateApplyModal } from "./TemplateApplyModal";
import { WeekCloneModal } from "./WeekCloneModal";
import { CATEGORY_COLORS } from "@/lib/planner/categories";
import { localToday, localDateStr } from "@/lib/dateUtils";
import { expandSerializedBlocks } from "@/lib/planner/expandClient";
import type { SerializedBlock } from "@/lib/planner/expandClient";
import type { ExpandedOccurrence, StabilityAlert } from "@/lib/planner/types";

interface WeeklyViewProps {
  initialWeekStart: string; // YYYY-MM-DD (Monday)
}

interface BlockFormData {
  id?: string;
  title: string;
  category: string;
  kind: string;
  date: string;
  startTime: string;
  endTime: string;
  energyCost: number;
  stimulation: number;
  notes: string;
  recurrenceFreq: string;
  recurrenceWeekDays: number[];
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
    // Find extent of this overlap group
    let groupEnd = groupStart;
    let maxEnd = new Date(sorted[groupStart].endAt).getTime();

    while (groupEnd + 1 < sorted.length && new Date(sorted[groupEnd + 1].startAt).getTime() < maxEnd) {
      groupEnd++;
      maxEnd = Math.max(maxEnd, new Date(sorted[groupEnd].endAt).getTime());
    }

    // Assign columns within this group
    const columns: number[] = []; // end times for each column
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Partial<BlockFormData> | undefined>();
  const [editingBlockId, setEditingBlockId] = useState<string | undefined>();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async (start: string) => {
    setLoading(true);
    try {
      const end = addDays(start, 6);
      const res = await fetch(
        `/api/planner/blocks?timeMin=${start}T00:00:00&timeMax=${end}T23:59:59`,
      );
      if (!res.ok) throw new Error("Fetch failed");
      const data: SerializedBlock[] = await res.json();

      const expanded = expandSerializedBlocks(data, new Date(start + "T00:00:00"), new Date(end + "T23:59:59"));
      setOccurrences(expanded);

      const rulesRes = await fetch("/api/planner/rules");
      if (rulesRes.ok) {
        const rules = await rulesRes.json();
        // Filter to only occurrences whose date falls within the 7-day week
        // This prevents "8 late nights" caused by edge-of-range blocks
        const weekOccs = expanded.filter((o) => o.occurrenceDate >= start && o.occurrenceDate <= end);
        const constraintAlerts = checkConstraintsClient(weekOccs, rules);
        setAlerts(constraintAlerts);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(weekStart);
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

  function openNewBlock(date: string, hour?: number) {
    const startTime = hour !== undefined
      ? `${String(hour).padStart(2, "0")}:00`
      : undefined;
    const endTime = hour !== undefined
      ? `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`
      : undefined;
    setEditingBlock({ date, id: undefined, startTime, endTime } as Partial<BlockFormData>);
    setEditingBlockId(undefined);
    setModalOpen(true);
  }

  function openEditBlock(occ: ExpandedOccurrence) {
    setEditingBlock({
      id: occ.blockId,
      title: occ.title,
      category: occ.category,
      kind: occ.kind,
      date: occ.occurrenceDate,
      startTime: formatTime(occ.startAt),
      endTime: formatTime(occ.endAt),
      energyCost: occ.energyCost,
      stimulation: occ.stimulation,
      notes: occ.notes || "",
      recurrenceFreq: "NONE",
      recurrenceWeekDays: [],
    });
    setEditingBlockId(occ.blockId);
    setModalOpen(true);
  }

  async function handleSave(data: BlockFormData) {
    const startDate = new Date(`${data.date}T${data.startTime}:00`);
    const endDate = new Date(`${data.date}T${data.endTime}:00`);
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const body: Record<string, unknown> = {
      title: data.title,
      category: data.category,
      kind: data.kind,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      notes: data.notes || undefined,
      energyCost: data.energyCost,
      stimulation: data.stimulation,
    };

    if (data.recurrenceFreq !== "NONE") {
      body.recurrence = {
        freq: data.recurrenceFreq,
        interval: 1,
        weekDays: data.recurrenceFreq === "WEEKLY" ? data.recurrenceWeekDays.join(",") : undefined,
      };
    }

    if (data.id) {
      await fetch(`/api/planner/blocks/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/planner/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    await fetchData(weekStart);
  }

  async function handleDelete() {
    if (!editingBlockId) return;
    await fetch(`/api/planner/blocks/${editingBlockId}`, { method: "DELETE" });
    await fetchData(weekStart);
  }

  function handlePartialParse(parsed: Record<string, unknown>) {
    const startAt = parsed.startAt ? new Date(parsed.startAt as string) : new Date();
    const endAt = parsed.endAt ? new Date(parsed.endAt as string) : new Date();
    setEditingBlock({
      title: (parsed.title as string) || "",
      category: (parsed.category as string) || "outro",
      kind: (parsed.kind as string) || "FLEX",
      date: localDateStr(startAt),
      startTime: formatTime(startAt),
      endTime: formatTime(endAt),
      energyCost: (parsed.energyCost as number) || 3,
      stimulation: (parsed.stimulation as number) || 1,
      notes: "",
      recurrenceFreq: "NONE",
      recurrenceWeekDays: [],
    });
    setEditingBlockId(undefined);
    setModalOpen(true);
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
        </div>
        <button
          onClick={() => navigateWeek(1)}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:border-primary/50"
        >
          Proximo &rarr;
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex-1">
          <QuickAddInput
            contextDate={weekStart}
            onCreated={() => fetchData(weekStart)}
            onPartialParse={handlePartialParse}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTemplateModalOpen(true)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/50 hover:text-foreground"
          >
            Template
          </button>
          <button
            onClick={() => setCloneModalOpen(true)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/50 hover:text-foreground"
          >
            Copiar semana
          </button>
        </div>
      </div>

      {/* Week-level alerts (no conflict alerts — overlaps are shown visually) */}
      {alerts.filter((a) => a.type === "max_late_nights").map((a, i) => (
        <Alert key={i} variant="warning" className="mb-3">
          {a.message} Este alerta e automatico e nao substitui avaliacao profissional.
        </Alert>
      ))}

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
                    onClick={(e) => {
                      // Click on empty area to create block at that hour
                      if ((e.target as HTMLElement).closest("button")) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const hour = Math.floor(y / HOUR_HEIGHT);
                      openNewBlock(day, hour);
                    }}
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

                    {/* Blocks */}
                    {layout.map((lb, k) => {
                      const startH = new Date(lb.occ.startAt).getHours() + new Date(lb.occ.startAt).getMinutes() / 60;
                      let endH = new Date(lb.occ.endAt).getHours() + new Date(lb.occ.endAt).getMinutes() / 60;
                      // Cross-midnight: cap at 24
                      if (endH <= startH) endH = 24;

                      const top = startH * HOUR_HEIGHT;
                      const height = Math.max((endH - startH) * HOUR_HEIGHT, 18);
                      const leftPct = (lb.col / lb.totalCols) * 100;
                      const widthPct = (1 / lb.totalCols) * 100;
                      const colors = CATEGORY_COLORS[lb.occ.category] || CATEGORY_COLORS.outro;
                      const isShort = height < 36;

                      return (
                        <button
                          key={k}
                          onClick={(e) => { e.stopPropagation(); openEditBlock(lb.occ); }}
                          className={`absolute z-10 overflow-hidden rounded border text-left transition-opacity hover:opacity-80 ${colors}`}
                          style={{
                            top,
                            height,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 2px)`,
                            marginLeft: 1,
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
                                {lb.occ.isRoutine && <span className="ml-0.5 opacity-60">↻</span>}
                              </div>
                              <div className="text-[9px] opacity-75 leading-tight">
                                {formatTime(lb.occ.startAt)} – {formatTime(lb.occ.endAt)}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <BlockEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={editingBlockId ? handleDelete : undefined}
        initial={editingBlock}
        isRecurring={editingBlock?.id !== undefined}
      />

      <TemplateApplyModal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        onApplied={() => fetchData(weekStart)}
        weekStart={weekStart}
      />

      <WeekCloneModal
        isOpen={cloneModalOpen}
        onClose={() => setCloneModalOpen(false)}
        onCloned={() => fetchData(weekStart)}
        currentWeekStart={weekStart}
      />
    </div>
  );
}

// ── Client-side helpers ────────────────────────────────────────────

function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Constraint checking (no conflict alerts — overlaps are visual now)
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

    // Late nights (skip Google-sourced blocks)
    for (const occ of sorted) {
      if (occ.sourceType === "google") continue;
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
      message: `${lateNightDates.length} noites tardias nesta semana (limite: ${rules.maxLateNightsPerWeek}). Este alerta e automatico e nao substitui avaliacao profissional.`,
      date: lateNightDates[0],
      blockIds: [],
    });
  }

  return alerts;
}
