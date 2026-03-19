"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/Card";

// ── Types ────────────────────────────────────────────────────

type JournalType = "DIARY" | "QUICK_INSIGHT";

interface JournalEntry {
  id: string;
  type: JournalType;
  content: string;
  maniaScore: number | null;
  depressionScore: number | null;
  energyScore: number | null;
  zoneAtCapture: string | null;
  mixedAtCapture: boolean | null;
  snapshotSource: string;
  entryDateLocal: string;
  aiUseAllowed: boolean;
  editedAt: string | null;
  createdAt: string;
}

interface ReflectionData {
  periodStart: string;
  periodEnd: string;
  stats: {
    totalEntries: number;
    diaryCount: number;
    insightCount: number;
    daysWithEntries: number;
    avgMood: number | null;
    avgSleep: number | null;
    medicationAdherence: number | null;
  };
  moodJourney: {
    zone: string;
    label: string;
    count: number;
    excerpts: string[];
  }[];
  highlights: string[];
}

interface Props {
  initialEntries: JournalEntry[];
  hasConsent: boolean;
  userId: string;
}

// ── Zone config ──────────────────────────────────────────────

const ZONE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  depressao: { label: "Humor muito baixo", color: "text-blue-800", bg: "bg-blue-100" },
  depressao_leve: { label: "Humor baixo", color: "text-blue-700", bg: "bg-blue-50" },
  eutimia: { label: "Humor estável", color: "text-emerald-800", bg: "bg-emerald-100" },
  hipomania: { label: "Humor elevado", color: "text-amber-800", bg: "bg-amber-100" },
  mania: { label: "Humor muito elevado", color: "text-red-800", bg: "bg-red-100" },
};

const DIARY_MAX = 5000;
const INSIGHT_MAX = 280;

// ── Local draft persistence (24h TTL) ────────────────────────

const DRAFT_KEY = "journal_draft";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface Draft {
  tab: JournalType;
  content: string;
  savedAt: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: Draft = JSON.parse(raw);
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(tab: JournalType, content: string) {
  try {
    if (!content.trim()) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: Draft = { tab, content, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ── Component ────────────────────────────────────────────────

export function JournalClient({ initialEntries, hasConsent }: Props) {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  // Load draft once on mount
  const [initialDraft] = useState(() => loadDraft());
  const [tab, setTab] = useState<JournalType>(initialDraft?.tab ?? "DIARY");
  const [content, setContent] = useState(initialDraft?.content ?? "");
  const [draftRestored, setDraftRestored] = useState(
    initialDraft !== null && initialDraft.content.trim().length > 0,
  );
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showConsent, setShowConsent] = useState(!hasConsent);
  const [consentGranted, setConsentGranted] = useState(hasConsent);
  const [showSOS, setShowSOS] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialEntries.length >= 20 ? initialEntries[initialEntries.length - 1]?.id : null,
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<JournalType | "ALL">("ALL");
  const [reflection, setReflection] = useState<ReflectionData | null>(null);
  const [loadingReflection, setLoadingReflection] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save draft to localStorage on content/tab change
  useEffect(() => {
    saveDraft(tab, content);
    if (draftRestored && content.trim().length === 0) {
      setDraftRestored(false);
    }
  }, [tab, content, draftRestored]);

  const maxChars = tab === "DIARY" ? DIARY_MAX : INSIGHT_MAX;
  const editMaxChars = editingId
    ? entries.find((e) => e.id === editingId)?.type === "DIARY"
      ? DIARY_MAX
      : INSIGHT_MAX
    : DIARY_MAX;

  // ── Consent flow ───────────────────────────────────────────

  const handleConsent = useCallback(async () => {
    try {
      const res = await fetch("/api/journal/consent", { method: "POST" });
      if (res.ok) {
        setConsentGranted(true);
        setShowConsent(false);
      }
    } catch {
      // silently fail
    }
  }, []);

  if (showConsent && !consentGranted) {
    return (
      <Card>
        <h2 className="mb-3 text-lg font-semibold">Consentimento — Diário Pessoal</h2>
        <div className="space-y-3 text-sm text-muted">
          <p>
            Seu diário contém pensamentos e sentimentos pessoais. Esses dados são
            classificados como <strong>dados sensíveis de saúde</strong> pela LGPD.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Suas entradas são armazenadas de forma segura e criptografada</li>
            <li>Nenhum conteúdo é compartilhado com profissionais de saúde</li>
            <li>Você pode apagar qualquer entrada a qualquer momento</li>
            <li>O uso por inteligência artificial é opcional e controlado por você</li>
            <li>Ao excluir sua conta, todas as entradas são permanentemente apagadas</li>
          </ul>
          <p className="text-xs">
            Este diário é uma ferramenta de auto-observação, não um canal de emergência.
            Em caso de crise, ligue CVV 188 ou SAMU 192.
          </p>
          <p className="text-xs">
            Ao continuar, você consente com o armazenamento dos seus textos conforme
            a LGPD Art. 11, I. Você pode revogar este consentimento a qualquer momento
            nas configurações da conta.
          </p>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleConsent}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Concordo e quero usar
          </button>
          <a
            href="/hoje"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted"
          >
            Voltar
          </a>
        </div>
      </Card>
    );
  }

  // ── Save entry ─────────────────────────────────────────────

  const handleSave = async () => {
    if (!content.trim() || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tab,
          content: content.trim(),
          idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao salvar.");
        return;
      }

      const data = await res.json();

      // Show SOS if crisis detected — never block
      if (data.crisisDetected) {
        setShowSOS(true);
      }

      // Reload entries to get full data
      setContent("");
      clearDraft();
      setDraftRestored(false);
      const listRes = await fetch("/api/journal?limit=20");
      if (listRes.ok) {
        const listData = await listRes.json();
        setEntries(listData.items);
        setNextCursor(listData.nextCursor);
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  };

  // ── Edit entry ─────────────────────────────────────────────

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return;

    try {
      const res = await fetch(`/api/journal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao editar.");
        return;
      }

      const data = await res.json();
      if (data.crisisDetected) setShowSOS(true);

      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, content: editContent.trim(), editedAt: new Date().toISOString() }
            : e,
        ),
      );
      setEditingId(null);
      setEditContent("");
    } catch {
      alert("Erro de conexão.");
    }
  };

  // ── Delete entry ───────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza? Esta ação é permanente.")) return;

    try {
      const res = await fetch(`/api/journal/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch {
      alert("Erro ao excluir.");
    }
  };

  // ── Load more ──────────────────────────────────────────────

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({ cursor: nextCursor, limit: "20" });
      if (filter !== "ALL") params.set("type", filter);

      const res = await fetch(`/api/journal?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Load weekly reflection ──────────────────────────────────

  const loadReflection = async () => {
    if (loadingReflection) return;
    setLoadingReflection(true);
    try {
      const res = await fetch("/api/journal/reflection");
      if (res.ok) {
        const data = await res.json();
        setReflection(data.reflection);
      }
    } finally {
      setLoadingReflection(false);
    }
  };

  // ── Filtered entries ───────────────────────────────────────

  const filteredEntries =
    filter === "ALL" ? entries : entries.filter((e) => e.type === filter);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* SOS Banner — supportive, never accusatory */}
      {showSOS && (
        <Card className="border-red-300 bg-red-50">
          <div className="space-y-3">
            <p className="font-semibold text-red-900">
              Você não está sozinho.
            </p>
            <p className="text-sm text-red-800">
              Sua entrada foi salva. Se estiver precisando de apoio agora, há pessoas prontas para ouvir você:
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="tel:188"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
              >
                CVV 188 (24h)
              </a>
              <a
                href="tel:192"
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white"
              >
                SAMU 192
              </a>
              <a
                href="/sos"
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-800"
              >
                Meu plano SOS
              </a>
            </div>
            <button
              onClick={() => setShowSOS(false)}
              className="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              Fechar esta mensagem
            </button>
            <p className="text-[10px] text-red-600/70 italic">
              Esta é uma sugestão automática — não substitui avaliação profissional.
            </p>
          </div>
        </Card>
      )}

      {/* New Entry */}
      <Card>
        {/* Draft restored banner */}
        {draftRestored && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-800">
              Rascunho recuperado automaticamente.
            </p>
            <button
              onClick={() => { setContent(""); setDraftRestored(false); clearDraft(); }}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium ml-2"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Tab selector */}
        <div className="flex gap-1 mb-4 rounded-lg bg-surface-alt p-1">
          <button
            onClick={() => { setTab("DIARY"); }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === "DIARY"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Diário
          </button>
          <button
            onClick={() => { setTab("QUICK_INSIGHT"); setContent((c) => c.slice(0, INSIGHT_MAX)); }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === "QUICK_INSIGHT"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Insight Rápido
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
          placeholder={
            tab === "DIARY"
              ? "Como você está se sentindo? O que está pensando?"
              : "Um pensamento rápido..."
          }
          rows={tab === "DIARY" ? 6 : 3}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-muted/60 resize-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={maxChars}
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">
            {content.length}/{maxChars}
            {tab === "QUICK_INSIGHT" && content.length > 250 && (
              <span className="ml-2 text-amber-600">
                Texto longo? <button
                  onClick={() => { setTab("DIARY"); }}
                  className="underline"
                >
                  Converter em diário
                </button>
              </span>
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={!content.trim() || saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Card>

      {/* Filter + Export */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2">
          {(["ALL", "DIARY", "QUICK_INSIGHT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-white"
                  : "bg-surface-alt text-muted hover:text-foreground"
              }`}
            >
              {f === "ALL" ? "Todos" : f === "DIARY" ? "Diário" : "Insights"}
            </button>
          ))}
          <a
            href="/api/journal/export"
            download
            className="ml-auto rounded-full px-3 py-1 text-xs font-medium bg-surface-alt text-muted hover:text-foreground"
            title="Exportar todas as entradas (JSON)"
          >
            Exportar
          </a>
        </div>
      )}

      {/* Weekly Reflection */}
      {entries.length >= 3 && (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reflexão da semana</h3>
            {!reflection && (
              <button
                onClick={loadReflection}
                disabled={loadingReflection}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                {loadingReflection ? "Gerando..." : "Ver reflexão"}
              </button>
            )}
            {reflection && (
              <button
                onClick={() => setReflection(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                Fechar
              </button>
            )}
          </div>

          {reflection && (
            <div className="mt-3 space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">{reflection.stats.totalEntries}</p>
                  <p className="text-[10px] text-muted">entradas</p>
                </div>
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">{reflection.stats.daysWithEntries}</p>
                  <p className="text-[10px] text-muted">dias</p>
                </div>
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">
                    {reflection.stats.avgMood ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted">humor médio</p>
                </div>
              </div>

              {/* Mood journey */}
              {reflection.moodJourney.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted mb-2">
                    O que você escreveu em cada estado:
                  </p>
                  <div className="space-y-2">
                    {reflection.moodJourney.map((mj) => (
                      <div key={mj.zone} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{mj.label}</span>
                          <span className="text-[10px] text-muted">
                            ({mj.count} {mj.count === 1 ? "entrada" : "entradas"})
                          </span>
                        </div>
                        {mj.excerpts.map((ex, i) => (
                          <p key={i} className="text-xs text-muted italic pl-2 border-l-2 border-primary/20 mt-1">
                            &ldquo;{ex}&rdquo;
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlights */}
              {reflection.highlights.length > 0 && (
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1">Destaques</p>
                  <ul className="space-y-1">
                    {reflection.highlights.map((h, i) => (
                      <li key={i} className="text-xs text-foreground">{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[10px] text-muted italic text-center">
                Período: {formatPeriod(reflection.periodStart)} a {formatPeriod(reflection.periodEnd)}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Entries list */}
      {filteredEntries.length === 0 ? (
        <p className="text-center text-sm text-muted py-8">
          {entries.length === 0
            ? "Nenhuma entrada ainda. Comece escrevendo acima."
            : "Nenhuma entrada nesta categoria."}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="relative">
              {/* Header: date + mood badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {formatDate(entry.entryDateLocal, entry.createdAt)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      entry.type === "DIARY"
                        ? "bg-primary/10 text-primary"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {entry.type === "DIARY" ? "Diário" : "Insight"}
                  </span>
                  {entry.editedAt && (
                    <span className="text-[10px] text-muted">(editado)</span>
                  )}
                </div>

                {/* Mood badge — shows mood state at time of writing */}
                {entry.snapshotSource === "RECENT_CHECKIN" && entry.zoneAtCapture ? (
                  <MoodBadge
                    zone={entry.zoneAtCapture}
                    maniaScore={entry.maniaScore}
                    depressionScore={entry.depressionScore}
                    mixed={entry.mixedAtCapture}
                  />
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                    Sem registro de humor
                  </span>
                )}
              </div>

              {/* Content or edit mode */}
              {editingId === entry.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value.slice(0, editMaxChars))}
                    rows={entry.type === "DIARY" ? 5 : 2}
                    className="w-full rounded-lg border border-border bg-surface p-3 text-sm resize-none focus:border-primary focus:outline-none"
                    maxLength={editMaxChars}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(entry.id)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditContent(""); }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                  {entry.content}
                </p>
              )}

              {/* Actions */}
              {editingId !== entry.id && (
                <div className="mt-3 flex gap-3 border-t border-border pt-2">
                  <button
                    onClick={() => {
                      setEditingId(entry.id);
                      setEditContent(entry.content);
                    }}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </Card>
          ))}

          {/* Load more */}
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
            >
              {loadingMore ? "Carregando..." : "Ver mais entradas"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mood Badge ───────────────────────────────────────────────

function MoodBadge({
  zone,
  maniaScore,
  depressionScore,
  mixed,
}: {
  zone: string;
  maniaScore: number | null;
  depressionScore: number | null;
  mixed: boolean | null;
}) {
  const config = ZONE_LABELS[zone];
  if (!config) return null;

  return (
    <div className="flex items-center gap-1.5">
      {mixed && (
        <span
          className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-800"
          title="Sinais de mania e depressão ao mesmo tempo"
        >
          Sinais mistos
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${config.bg} ${config.color}`}
        title={`M: ${maniaScore ?? "?"} D: ${depressionScore ?? "?"}`}
      >
        {config.label}
      </span>
    </div>
  );
}

// ── Date formatter ───────────────────────────────────────────

function formatPeriod(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00Z").toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatDate(dateLocal: string, createdAt: string): string {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now.getTime() - created.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;

  // Format as "15 mar 2026, 14:30"
  try {
    return new Date(createdAt).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return dateLocal;
  }
}
