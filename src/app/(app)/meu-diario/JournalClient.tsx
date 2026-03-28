"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/Card";
import { useJournalDraft, clearDraft } from "./useJournalDraft";
import { useJournalEntries } from "./useJournalEntries";
import type { JournalEntry } from "./useJournalEntries";

// ── Types ────────────────────────────────────────────────────

type JournalType = "DIARY" | "QUICK_INSIGHT";

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

// ── Component ────────────────────────────────────────────────

export function JournalClient({ initialEntries, hasConsent }: Props) {
  const draft = useJournalDraft();
  const journal = useJournalEntries(initialEntries);

  const [showConsent, setShowConsent] = useState(!hasConsent);
  const [consentGranted, setConsentGranted] = useState(hasConsent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const maxChars = draft.tab === "DIARY" ? DIARY_MAX : INSIGHT_MAX;
  const editMaxChars = journal.editingId
    ? journal.entries.find((e) => e.id === journal.editingId)?.type === "DIARY"
      ? DIARY_MAX
      : INSIGHT_MAX
    : DIARY_MAX;

  // ── Consent flow ───────────────────────────────────────────

  const handleConsent = async () => {
    try {
      const res = await fetch("/api/journal/consent", { method: "POST" });
      if (res.ok) {
        setConsentGranted(true);
        setShowConsent(false);
      }
    } catch {
      // silently fail
    }
  };

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

  const handleSave = () => {
    journal.handleSave(draft.tab, draft.content, () => {
      draft.setContent("");
      clearDraft();
      draft.setDraftRestored(false);
    });
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* SOS Banner — supportive, never accusatory */}
      {journal.showSOS && (
        <Card className="border-danger-border bg-danger-bg-subtle">
          <div className="space-y-3">
            <p className="font-semibold text-danger-fg">
              Você não está sozinho.
            </p>
            <p className="text-sm text-danger-fg">
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
                className="rounded-lg border border-danger-border px-4 py-2 text-sm font-medium text-danger-fg"
              >
                Meu plano SOS
              </a>
            </div>
            <button
              onClick={() => journal.setShowSOS(false)}
              className="text-xs text-danger hover:text-danger-fg mt-1"
            >
              Fechar esta mensagem
            </button>
            <p className="text-[11px] text-danger/70 italic">
              Esta é uma sugestão automática — não substitui avaliação profissional.
            </p>
          </div>
        </Card>
      )}

      {/* New Entry */}
      <Card>
        {/* Draft restored banner */}
        {draft.draftRestored && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-warning-bg-subtle border border-warning-border px-3 py-2">
            <p className="text-xs text-warning-fg">
              Rascunho recuperado automaticamente.
            </p>
            <button
              onClick={draft.discardDraft}
              className="text-xs text-warning hover:text-warning-fg font-medium ml-2"
            >
              Descartar
            </button>
          </div>
        )}

        {/* Tab selector */}
        <div className="flex gap-1 mb-4 rounded-lg bg-surface-alt p-1">
          <button
            onClick={() => { draft.setTab("DIARY"); }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              draft.tab === "DIARY"
                ? "bg-primary text-white shadow-[var(--shadow-card)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            Diário
          </button>
          <button
            onClick={() => { draft.setTab("QUICK_INSIGHT"); draft.setContent((c) => c.slice(0, INSIGHT_MAX)); }}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              draft.tab === "QUICK_INSIGHT"
                ? "bg-primary text-white shadow-[var(--shadow-card)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            Insight Rápido
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={draft.content}
          onChange={(e) => draft.setContent(e.target.value.slice(0, maxChars))}
          placeholder={
            draft.tab === "DIARY"
              ? "Como você está se sentindo? O que está pensando?"
              : "Um pensamento rápido..."
          }
          rows={draft.tab === "DIARY" ? 6 : 3}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-muted/60 resize-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          maxLength={maxChars}
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted">
            {draft.content.length}/{maxChars}
            {draft.tab === "QUICK_INSIGHT" && draft.content.length > 250 && (
              <span className="ml-2 text-warning">
                Texto longo? <button
                  onClick={() => { draft.setTab("DIARY"); }}
                  className="underline"
                >
                  Converter em diário
                </button>
              </span>
            )}
          </span>
          <button
            onClick={handleSave}
            disabled={!draft.content.trim() || journal.saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {journal.saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </Card>

      {/* Filter + Export */}
      {journal.entries.length > 0 && (
        <div className="flex items-center gap-2">
          {(["ALL", "DIARY", "QUICK_INSIGHT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => journal.setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                journal.filter === f
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
      {journal.entries.length >= 3 && (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Reflexão da semana</h3>
            {!journal.reflection && (
              <button
                onClick={journal.loadReflection}
                disabled={journal.loadingReflection}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
              >
                {journal.loadingReflection ? "Gerando..." : "Ver reflexão"}
              </button>
            )}
            {journal.reflection && (
              <button
                onClick={() => journal.setReflection(null)}
                className="text-xs text-muted hover:text-foreground"
              >
                Fechar
              </button>
            )}
          </div>

          {journal.reflection && (
            <div className="mt-3 space-y-3">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">{journal.reflection.stats.totalEntries}</p>
                  <p className="text-[11px] text-muted">entradas</p>
                </div>
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">{journal.reflection.stats.daysWithEntries}</p>
                  <p className="text-[11px] text-muted">dias</p>
                </div>
                <div className="rounded-lg bg-surface-alt p-2">
                  <p className="text-lg font-bold text-primary">
                    {journal.reflection.stats.avgMood ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted">humor médio</p>
                </div>
              </div>

              {/* Mood journey */}
              {journal.reflection.moodJourney.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted mb-2">
                    O que você escreveu em cada estado:
                  </p>
                  <div className="space-y-2">
                    {journal.reflection.moodJourney.map((mj) => (
                      <div key={mj.zone} className="rounded-lg border border-border p-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{mj.label}</span>
                          <span className="text-[11px] text-muted">
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
              {journal.reflection.highlights.length > 0 && (
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-medium text-primary mb-1">Destaques</p>
                  <ul className="space-y-1">
                    {journal.reflection.highlights.map((h, i) => (
                      <li key={i} className="text-xs text-foreground">{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-[11px] text-muted italic text-center">
                Período: {formatPeriod(journal.reflection.periodStart)} a {formatPeriod(journal.reflection.periodEnd)}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Entries list */}
      {journal.filteredEntries.length === 0 ? (
        <p className="text-center text-sm text-muted py-8">
          {journal.entries.length === 0
            ? "Escrever sobre como você se sente ajuda a entender seus padrões. Comece acima."
            : "Nenhuma entrada nesta categoria."}
        </p>
      ) : (
        <div className="space-y-3">
          {journal.filteredEntries.map((entry) => (
            <Card key={entry.id} className="relative">
              {/* Header: date + mood badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {formatDate(entry.entryDateLocal, entry.createdAt)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      entry.type === "DIARY"
                        ? "bg-primary/10 text-primary"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {entry.type === "DIARY" ? "Diário" : "Insight"}
                  </span>
                  {entry.editedAt && (
                    <span className="text-[11px] text-muted">(editado)</span>
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
                  <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-muted">
                    Sem registro de humor
                  </span>
                )}
              </div>

              {/* Content or edit mode */}
              {journal.editingId === entry.id ? (
                <div>
                  <textarea
                    value={journal.editContent}
                    onChange={(e) => journal.setEditContent(e.target.value.slice(0, editMaxChars))}
                    rows={entry.type === "DIARY" ? 5 : 2}
                    className="w-full rounded-lg border border-border bg-surface p-3 text-sm resize-none focus-visible:border-primary focus-visible:outline-none"
                    maxLength={editMaxChars}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => journal.handleEdit(entry.id)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => { journal.setEditingId(null); journal.setEditContent(""); }}
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
              {journal.editingId !== entry.id && (
                <div className="mt-3 flex gap-3 border-t border-border pt-2">
                  <button
                    onClick={() => {
                      journal.setEditingId(entry.id);
                      journal.setEditContent(entry.content);
                    }}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => journal.requestDelete(entry.id)}
                    className="text-xs text-danger hover:text-danger-fg"
                  >
                    Excluir
                  </button>
                </div>
              )}
            </Card>
          ))}

          {/* Load more */}
          {journal.nextCursor && (
            <button
              onClick={journal.loadMore}
              disabled={journal.loadingMore}
              className="w-full rounded-lg border border-border py-2 text-sm text-muted hover:text-foreground"
            >
              {journal.loadingMore ? "Carregando..." : "Ver mais entradas"}
            </button>
          )}
        </div>
      )}
      {/* Error banner */}
      {journal.errorMsg && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-lg bg-red-600 p-3 text-center text-sm text-white shadow-[var(--shadow-float)]">
          <p>{journal.errorMsg}</p>
          <button
            onClick={() => journal.setErrorMsg(null)}
            className="mt-1 text-xs underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {journal.pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-[var(--radius-card)] bg-surface p-6 shadow-[var(--shadow-float)]">
            <p className="mb-4 text-sm font-medium text-foreground">
              Tem certeza? Esta ação é permanente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={journal.cancelDelete}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={journal.confirmDelete}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white"
              >
                Excluir
              </button>
            </div>
          </div>
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
          className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[11px] font-medium text-purple-800"
          title="Sinais de mania e depressão ao mesmo tempo"
        >
          Sinais mistos
        </span>
      )}
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${config.bg} ${config.color}`}
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

