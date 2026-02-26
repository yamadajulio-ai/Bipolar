"use client";

import { useState } from "react";
import { localDateStr } from "@/lib/dateUtils";

interface WeekCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCloned: () => void;
  currentWeekStart: string;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function formatDateBR(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

export function WeekCloneModal({ isOpen, onClose, onCloned, currentWeekStart }: WeekCloneModalProps) {
  const prevWeekStart = addDays(currentWeekStart, -7);
  const [fromWeek, setFromWeek] = useState(prevWeekStart);
  const [mode, setMode] = useState<"all" | "flexOnly" | "exceptAnchors">("all");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  async function handleClone() {
    setSaving(true);
    try {
      const res = await fetch("/api/planner/weeks/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWeekStart: fromWeek,
          toWeekStart: currentWeekStart,
          mode,
        }),
      });
      if (res.ok) {
        onCloned();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  const weeks = Array.from({ length: 4 }, (_, i) => addDays(currentWeekStart, -(i + 1) * 7));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Copiar semana</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Copiar de</label>
            <select
              value={fromWeek}
              onChange={(e) => setFromWeek(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {formatDateBR(w)} — {formatDateBR(addDays(w, 6))}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">O que copiar</label>
            <div className="flex gap-2">
              {([
                { value: "all" as const, label: "Tudo" },
                { value: "flexOnly" as const, label: "So Flex" },
                { value: "exceptAnchors" as const, label: "Sem Ancoras" },
              ]).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                    mode === m.value
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-muted hover:border-primary/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">
              Rotinas sao ignoradas (ja repetem automaticamente). Duplicatas sao detectadas.
            </p>
          </div>

          <button
            onClick={handleClone}
            disabled={saving}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Copiando..." : "Copiar para esta semana"}
          </button>
        </div>
      </div>
    </div>
  );
}
