"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/Card";

interface Note {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotasPage() {
  const params = useParams();
  const token = params.token as string;
  const [notes, setNotes] = useState<Note[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/acesso-profissional/${token}/notas`);
      if (res.ok) {
        setNotes(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/acesso-profissional/${token}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        await fetchNotes();
      } else {
        const data = await res.json();
        setError(data.error || "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Excluir esta observação?")) return;
    try {
      const res = await fetch(`/api/acesso-profissional/${token}/notas?id=${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch {
      // silent
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Observações Clínicas</h1>
        <p className="text-sm text-muted mt-1">
          Suas anotações privadas sobre este paciente. Somente você pode ver.
        </p>
      </div>

      {/* New note form */}
      <Card className="mb-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma observação sobre o paciente..."
          rows={4}
          maxLength={5000}
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted resize-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-[11px] text-muted">
            {content.length}/5000
          </span>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 min-h-[44px]"
          >
            {saving ? "Salvando..." : "Salvar observação"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </Card>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[var(--radius-card)] bg-surface-alt" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card>
          <p className="text-center text-muted py-4">
            Nenhuma observação registrada ainda. Suas anotações ficam vinculadas a este link de acesso.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground whitespace-pre-wrap flex-1">
                  {note.content}
                </p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="shrink-0 text-xs text-muted hover:text-danger-fg transition-colors min-h-[44px] px-2"
                  aria-label="Excluir observação"
                >
                  Excluir
                </button>
              </div>
              <p className="text-[11px] text-muted mt-2">
                {formatDate(note.createdAt)}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
