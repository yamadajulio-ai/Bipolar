"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { LIFE_CHART_EVENT_TYPES } from "@/lib/constants";
import { localToday } from "@/lib/dateUtils";

interface LifeChartEvent {
  id: string;
  date: string;
  eventType: string;
  label: string;
  notes: string | null;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  med_change: "bg-purple-500/20 text-purple-300 border-purple-700",
  stressor: "bg-red-500/20 text-red-300 border-red-700",
  travel: "bg-cyan-500/20 text-cyan-300 border-cyan-700",
  hospitalization: "bg-red-700/20 text-red-200 border-red-800",
  therapy: "bg-green-500/20 text-green-300 border-green-700",
  menstrual: "bg-pink-500/20 text-pink-300 border-pink-700",
  other: "bg-foreground/10 text-muted border-border-strong",
};

export default function LifeChartPage() {
  const [events, setEvents] = useState<LifeChartEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(localToday());
  const [eventType, setEventType] = useState("stressor");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/life-chart?days=365");
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      } else {
        setError("Erro ao carregar eventos.");
      }
    } catch {
      setError("Erro de conexão ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/life-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          eventType,
          label: label.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar.");
        return;
      }

      setLabel("");
      setNotes("");
      setShowForm(false);
      fetchEvents();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      const res = await fetch(`/api/life-chart?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      } else {
        setError("Erro ao remover evento.");
      }
    } catch {
      setError("Erro de conexão ao remover evento.");
    }
  }

  // Group events by month
  const grouped = events.reduce<Record<string, LifeChartEvent[]>>((acc, evt) => {
    const month = evt.date.slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = [];
    acc[month].push(evt);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort().reverse();

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Life Chart</h1>
          <p className="text-sm text-muted">
            Registre eventos importantes da sua vida que podem influenciar o humor.
          </p>
          <p className="text-xs text-muted italic">Este recurso não substitui avaliação profissional.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          {showForm ? "Fechar" : "+ Evento"}
        </button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {showForm && (
        <Card className="mb-4 space-y-3">
          <div>
            <label htmlFor="lc-date" className="block text-xs font-medium text-muted mb-1">Data</label>
            <input
              id="lc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div role="group" aria-label="Tipo de evento">
            <label className="block text-xs font-medium text-muted mb-1">Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {LIFE_CHART_EVENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setEventType(t.key)}
                  aria-pressed={eventType === t.key}
                  className={`min-h-[44px] rounded-full border px-3 py-1 text-xs transition-colors ${
                    eventType === t.key
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted hover:border-primary/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="lc-label" className="block text-xs font-medium text-muted mb-1">Descrição</label>
            <input
              id="lc-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              placeholder="Ex: Mudança de medicação"
              className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="lc-notes" className="block text-xs font-medium text-muted mb-1">
              Notas (opcional)
            </label>
            <textarea
              id="lc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={2}
              className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground"
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={saving || !label.trim()}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Adicionar evento"}
          </button>
        </Card>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted">Carregando...</p>
      ) : events.length === 0 ? (
        <Card className="py-8 text-center">
          <p className="text-muted">Seu Life Chart começa aqui.</p>
          <p className="mt-1 text-xs text-muted">
            Registre marcos importantes — mudanças de medicação, eventos estressantes, conquistas — para visualizar sua jornada.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {months.map((month) => {
            const [y, m] = month.split("-");
            const monthLabel = new Date(Number(y), Number(m) - 1)
              .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

            return (
              <div key={month}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  {monthLabel}
                </h3>
                <div className="space-y-2">
                  {grouped[month].map((evt) => {
                    const typeInfo = LIFE_CHART_EVENT_TYPES.find(
                      (t) => t.key === evt.eventType,
                    );
                    const colors =
                      EVENT_TYPE_COLORS[evt.eventType] || EVENT_TYPE_COLORS.other;

                    return (
                      <div
                        key={evt.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 ${colors}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {new Date(evt.date + "T12:00:00").toLocaleDateString(
                                "pt-BR",
                                { day: "2-digit", month: "short" },
                              )}
                            </span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                              {typeInfo?.label || evt.eventType}
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm">{evt.label}</p>
                          {evt.notes && (
                            <p className="mt-0.5 text-xs opacity-70">{evt.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setPendingDeleteId(evt.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs opacity-50 hover:opacity-100"
                          aria-label="Remover evento"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-muted">
        Registrar eventos ajuda a entender o que pode ter influenciado mudanças no seu humor.
        Baseado em método clínico internacional (NIMH Life Chart).
      </p>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4">
          <div className="w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-float)]">
            <p className="mb-4 text-sm font-medium text-foreground">
              Remover este evento? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDeleteId(null)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-lg bg-danger py-2.5 text-sm font-medium text-on-danger"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
