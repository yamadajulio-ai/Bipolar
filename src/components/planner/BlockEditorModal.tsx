"use client";

import { useState } from "react";
import { localToday } from "@/lib/dateUtils";
import {
  BLOCK_CATEGORIES,
  BLOCK_KINDS,
  STIMULATION_LEVELS,
  RECURRENCE_OPTIONS,
  WEEKDAY_LABELS,
} from "@/lib/planner/categories";
import { CATEGORY_DEFAULTS } from "@/lib/planner/defaults";

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

interface BlockEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: BlockFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  initial?: Partial<BlockFormData>;
  isRecurring?: boolean;
}

const defaultForm: BlockFormData = {
  title: "",
  category: "outro",
  kind: "FLEX",
  date: localToday(),
  startTime: "09:00",
  endTime: "10:00",
  energyCost: 3,
  stimulation: 1,
  notes: "",
  recurrenceFreq: "NONE",
  recurrenceWeekDays: [],
};

export function BlockEditorModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initial,
  isRecurring,
}: BlockEditorModalProps) {
  const [form, setForm] = useState<BlockFormData>({ ...defaultForm, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  function updateField<K extends keyof BlockFormData>(key: K, value: BlockFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Smart defaults: auto-fill when category changes on a new block
      if (key === "category" && !initial?.id) {
        const defaults = CATEGORY_DEFAULTS[value as string];
        if (defaults) {
          next.kind = defaults.kind;
          next.energyCost = defaults.energyCost;
          next.stimulation = defaults.stimulation;
          // Adjust end time based on category duration
          if (prev.startTime) {
            const [h, m] = prev.startTime.split(":").map(Number);
            const endMin = (h * 60 + m + defaults.durationMin) % 1440;
            const endH = Math.floor(endMin / 60);
            const endM = endMin % 60;
            next.endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
          }
        }
      }
      return next;
    });
  }

  function toggleWeekDay(day: number) {
    setForm((prev) => {
      const days = prev.recurrenceWeekDays.includes(day)
        ? prev.recurrenceWeekDays.filter((d) => d !== day)
        : [...prev.recurrenceWeekDays, day];
      return { ...prev, recurrenceWeekDays: days };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Titulo e obrigatorio.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch {
      setError("Erro ao salvar bloco.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setError("Erro ao remover bloco.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {initial?.id ? "Editar Bloco" : "Novo Bloco"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground">
              Titulo <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Acordar, Almoco, Trabalho..."
            />
          </div>

          {/* Category + Kind */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground">Categoria</label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {BLOCK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Tipo</label>
              <select
                value={form.kind}
                onChange={(e) => updateField("kind", e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {BLOCK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date + Times */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => updateField("date", e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Inicio</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => updateField("startTime", e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Fim</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => updateField("endTime", e.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Midnight crossing indicator */}
          {form.endTime && form.startTime && form.endTime <= form.startTime && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
              Termina no dia seguinte (bloco cruza meia-noite)
            </p>
          )}

          {/* Energy + Stimulation */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Custo de energia (0-10)
              </label>
              <input
                type="range"
                min={0}
                max={10}
                value={form.energyCost}
                onChange={(e) => updateField("energyCost", Number(e.target.value))}
                className="mt-2 w-full"
              />
              <p className="text-center text-sm text-muted">{form.energyCost}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Estimulacao</label>
              <div className="mt-2 flex gap-2">
                {STIMULATION_LEVELS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => updateField("stimulation", s.value)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      form.stimulation === s.value
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recurrence (only for new blocks or if not editing a single occurrence) */}
          {!isRecurring && (
            <div>
              <label className="block text-sm font-medium text-foreground">Recorrencia</label>
              <div className="mt-2 flex gap-2">
                {RECURRENCE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => updateField("recurrenceFreq", r.value)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                      form.recurrenceFreq === r.value
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Weekly day selection */}
          {form.recurrenceFreq === "WEEKLY" && (
            <div>
              <label className="block text-sm font-medium text-foreground">Dias da semana</label>
              <div className="mt-2 flex gap-1">
                {WEEKDAY_LABELS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleWeekDay(d.value)}
                    className={`flex-1 rounded-lg border px-1 py-1.5 text-xs font-medium transition-colors ${
                      form.recurrenceWeekDays.includes(d.value)
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground">Observacoes</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              maxLength={280}
              rows={2}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Opcional (max. 280 caracteres)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Remover
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
