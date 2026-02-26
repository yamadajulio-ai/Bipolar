"use client";

import { useState, useEffect, useCallback } from "react";
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

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const fetchData = useCallback(async (start: string) => {
    setLoading(true);
    try {
      const end = addDays(start, 7);
      const res = await fetch(
        `/api/planner/blocks?timeMin=${start}T00:00:00&timeMax=${end}T23:59:59`,
      );
      if (!res.ok) throw new Error("Fetch failed");
      const data: SerializedBlock[] = await res.json();

      // Expand recurrences client-side using shared engine
      const expanded = expandSerializedBlocks(data, new Date(start + "T00:00:00"), new Date(end + "T23:59:59"));
      setOccurrences(expanded);

      // Fetch rules and check constraints
      const rulesRes = await fetch("/api/planner/rules");
      if (rulesRes.ok) {
        const rules = await rulesRes.json();
        const constraintAlerts = checkConstraintsClient(expanded, rules);
        setAlerts(constraintAlerts);
      }
    } catch {
      // silently fail — empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(weekStart);
  }, [weekStart, fetchData]);

  function navigateWeek(dir: number) {
    setWeekStart(addDays(weekStart, dir * 7));
  }

  function goToToday() {
    const td = localToday();
    setWeekStart(getMonday(td));
  }

  function openNewBlock(date: string) {
    setEditingBlock({ date, id: undefined });
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
    // If endTime <= startTime, the block crosses midnight — move endAt to next day
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
    const startAt = startDate.toISOString();
    const endAt = endDate.toISOString();

    const body: Record<string, unknown> = {
      title: data.title,
      category: data.category,
      kind: data.kind,
      startAt,
      endAt,
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
      startTime: `${String(startAt.getHours()).padStart(2, "0")}:${String(startAt.getMinutes()).padStart(2, "0")}`,
      endTime: `${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}`,
      energyCost: (parsed.energyCost as number) || 3,
      stimulation: (parsed.stimulation as number) || 1,
      notes: "",
      recurrenceFreq: "NONE",
      recurrenceWeekDays: [],
    });
    setEditingBlockId(undefined);
    setModalOpen(true);
  }

  // Get occurrences for a specific day
  function getOccsForDay(dayStr: string): ExpandedOccurrence[] {
    return occurrences.filter((o) => o.occurrenceDate === dayStr);
  }

  // Get alerts for a specific day
  function getAlertsForDay(dayStr: string): StabilityAlert[] {
    return alerts.filter((a) => a.date === dayStr);
  }

  const today = localToday();

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

      {/* Toolbar: Quick-add + actions */}
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

      {/* Week-level alerts */}
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((day, i) => {
            const dayOccs = getOccsForDay(day);
            const dayAlerts = getAlertsForDay(day);
            const isToday = day === today;

            return (
              <div key={day} className={`rounded-lg border p-2 ${isToday ? "border-primary bg-primary/5" : "border-border"}`}>
                <div className="mb-2 flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted"}`}>
                    {WEEKDAY_NAMES[i]} {day.slice(8)}
                  </span>
                  <button
                    onClick={() => openNewBlock(day)}
                    className="text-xs text-primary hover:underline"
                    title="Adicionar bloco"
                  >
                    +
                  </button>
                </div>

                {/* Day alerts */}
                {dayAlerts.filter((a) => a.type !== "max_late_nights").map((a, j) => (
                  <div key={j} className={`mb-1 rounded px-1.5 py-0.5 text-[10px] ${
                    a.severity === "warning" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"
                  }`}>
                    {a.type === "conflict" ? "Conflito" : a.type === "late_night" ? "Noite tardia" : a.type === "wind_down" ? "Wind-down" : "Ancora"}
                  </div>
                ))}

                {/* Blocks */}
                <div className="space-y-1">
                  {dayOccs.map((occ, k) => {
                    const colors = CATEGORY_COLORS[occ.category] || CATEGORY_COLORS.outro;
                    return (
                      <button
                        key={k}
                        onClick={() => openEditBlock(occ)}
                        className={`w-full rounded border px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-80 ${colors}`}
                      >
                        <span className="font-medium">{formatTime(occ.startAt)}</span>{" "}
                        <span>{occ.title}</span>
                        {occ.kind === "ANCHOR" && <span className="ml-0.5 opacity-60">⚓</span>}
                        {occ.isRoutine && <span className="ml-0.5 opacity-60">↻</span>}
                      </button>
                    );
                  })}

                  {dayOccs.length === 0 && (
                    <p className="py-2 text-center text-[10px] text-muted">—</p>
                  )}
                </div>
              </div>
            );
          })}
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

// Simplified client-side constraint checking
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

    // Conflicts
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (new Date(sorted[i].endAt) > new Date(sorted[j].startAt)) {
          alerts.push({
            type: "conflict",
            severity: "warning",
            message: `"${sorted[i].title}" e "${sorted[j].title}" se sobrepoem.`,
            date,
            blockIds: [sorted[i].blockId, sorted[j].blockId],
          });
        }
      }
    }

    // Late nights
    for (const occ of sorted) {
      const endDate = new Date(occ.endAt);
      const endMin = endDate.getHours() * 60 + endDate.getMinutes();
      if (endMin > rules.lateEventCutoffMin && occ.kind !== "ANCHOR") {
        if (!lateNightDates.includes(date)) lateNightDates.push(date);
        alerts.push({
          type: "late_night",
          severity: "info",
          message: `"${occ.title}" termina apos o horario limite.`,
          date,
          blockIds: [occ.blockId],
        });
      }
    }

    // Anchor protection
    if (rules.protectAnchors) {
      const anchors = sorted.filter((o) => o.kind === "ANCHOR");
      const flexes = sorted.filter((o) => o.kind !== "ANCHOR");
      for (const anchor of anchors) {
        for (const flex of flexes) {
          if (new Date(flex.startAt) < new Date(anchor.endAt) && new Date(flex.endAt) > new Date(anchor.startAt)) {
            alerts.push({
              type: "anchor_override",
              severity: "warning",
              message: `"${flex.title}" conflita com ancora "${anchor.title}".`,
              date,
              blockIds: [flex.blockId, anchor.blockId],
            });
          }
        }
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
