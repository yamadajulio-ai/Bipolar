"use client";

import { useState, useEffect } from "react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  blocks: unknown[];
}

interface TemplateApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
  weekStart: string;
}

export function TemplateApplyModal({ isOpen, onClose, onApplied, weekStart }: TemplateApplyModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"merge" | "overwrite" | "missingOnly">("merge");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleApply() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${selectedId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, mode }),
      });
      if (res.ok) {
        onApplied();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCurrentWeek() {
    const name = prompt("Nome do template:");
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, fromWeekStart: weekStart }),
      });
      if (res.ok) {
        const created = await res.json();
        setTemplates((prev) => [created, ...prev]);
        setSelectedId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Templates</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        {loading ? (
          <p className="text-center text-sm text-muted py-4">Carregando...</p>
        ) : templates.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted mb-3">Nenhum template salvo.</p>
            <button
              onClick={handleSaveCurrentWeek}
              disabled={saving}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Salvar semana atual como template
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Template</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.blocks.length} blocos)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Modo</label>
              <div className="flex gap-2">
                {([
                  { value: "merge" as const, label: "Mesclar" },
                  { value: "missingOnly" as const, label: "Preencher" },
                  { value: "overwrite" as const, label: "Substituir" },
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
                {mode === "merge" && "Adiciona blocos sem sobrepor existentes."}
                {mode === "missingOnly" && "So adiciona se nao existe bloco no mesmo horario."}
                {mode === "overwrite" && "Remove blocos nao-rotina da semana e aplica o template."}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleApply}
                disabled={saving || !selectedId}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {saving ? "Aplicando..." : "Aplicar template"}
              </button>
              <button
                onClick={handleSaveCurrentWeek}
                disabled={saving}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:border-primary/50"
                title="Salvar semana atual como template"
              >
                Salvar semana
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
