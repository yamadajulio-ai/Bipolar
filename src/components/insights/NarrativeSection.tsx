"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { NarrativeResultV2 } from "@/lib/ai/narrative-types";
import { NARRATIVE_SECTION_KEYS, SECTION_LABELS, SECTION_ICONS } from "@/lib/ai/narrative-types";
import { toPublicEvidence } from "@/lib/ai/public-evidence";

interface RawEvidenceChip {
  text: string;
  domain: string;
  kind: string;
  confidence: string;
}

interface NarrativeResponse {
  cached: boolean;
  narrativeId?: string;
  narrative?: NarrativeResultV2;
  evidenceMap?: Record<string, RawEvidenceChip>;
  shareWithProfessional?: boolean;
  createdAt?: string;
  latestAttemptFailed?: boolean;
}

// ── Externalized deterministic phrases (per GPT Pro audit) ─────
const SHARE_WITH_PROFESSIONAL_TEXT =
  "Pode ser interessante compartilhar esses dados com seu profissional de referência.";
const APP_DISCLAIMER =
  "Esta análise é educacional e não substitui avaliação profissional. O app é uma ferramenta de acompanhamento.";

export function NarrativeSection() {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCache, setLoadingCache] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<"useful" | "not_useful" | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load cached narrative on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/insights-narrative");
        if (res.ok) {
          const json: NarrativeResponse = await res.json();
          if (!cancelled) {
            if (json.cached && json.narrative) {
              setData(json);
            } else if (json.latestAttemptFailed) {
              // Latest attempt failed guardrails — inform user
              setData(json);
            }
          }
        }
      } catch { /* ignore cache load errors */ }
      if (!cancelled) setLoadingCache(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(async () => {
    if (retryCooldown) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    setFeedbackSent(null);

    try {
      const res = await fetch("/api/insights-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errorMsg = "Erro ao gerar narrativa";
        try {
          const body = JSON.parse(text);
          if (body.error) errorMsg = body.error;
        } catch {
          // Response is not JSON (possibly Cloudflare WAF page)
          errorMsg = `Erro ${res.status}: ${res.statusText || "resposta inesperada"}`;
        }
        throw new Error(errorMsg);
      }
      const json: NarrativeResponse = await res.json();
      setData(json);
      setRetryCount(0);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      const delay = Math.min(5000 * Math.pow(2, retryCount), 30_000);
      setRetryCount((c) => c + 1);
      setRetryCooldown(true);
      cooldownTimer.current = setTimeout(() => setRetryCooldown(false), delay);
    } finally {
      setLoading(false);
    }
  }, [retryCooldown, retryCount]);

  const submitFeedback = useCallback(async (rating: "useful" | "not_useful") => {
    if (!data?.narrativeId) return;
    setFeedbackSent(rating);
    try {
      await fetch("/api/insights-narrative/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrativeId: data.narrativeId, rating }),
      });
    } catch { /* silent — feedback is best-effort */ }
  }, [data?.narrativeId]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const narrative = data?.narrative;

  // Still loading cache
  if (loadingCache) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5" role="status">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-muted">Carregando resumo...</p>
        </div>
      </div>
    );
  }

  // Not generated yet — show CTA with explicit consent
  if (!narrative && !loading && !error) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center">
        <p className="mb-1 text-sm font-semibold text-foreground">Resumo inteligente</p>

        {/* Guardrail failure warning */}
        {data?.latestAttemptFailed && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left dark:border-amber-800 dark:bg-amber-950">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sua narrativa mais recente não pôde ser exibida por não atender aos critérios de segurança.
              Você pode tentar gerar uma nova abaixo.
            </p>
          </div>
        )}

        <p className="mb-3 text-xs text-muted text-left">
          A IA analisa seus dados de sono, humor, ritmos, avaliações, eventos de vida e registros financeiros
          dos últimos 30 dias para gerar uma interpretação personalizada por área. Ao clicar, seus dados são
          enviados à OpenAI (processador terceiro) exclusivamente para gerar este resumo. Seus dados não são
          usados para treinar modelos e são retidos por até 30 dias para monitoramento de abuso, conforme a{" "}
          <a href="https://openai.com/policies/usage-policies" target="_blank" rel="noopener noreferrer" className="underline">
            política da OpenAI
          </a>.
        </p>

        {/* Explicit consent checkbox (LGPD: manifestação inequívoca para dados sensíveis) */}
        <label className="mb-4 flex items-start gap-2 cursor-pointer text-left">
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span className="text-xs text-foreground/80">
            Li e entendo que meus dados de saúde serão enviados à OpenAI para gerar este resumo.
            Posso revogar este consentimento a qualquer momento nas configurações da conta.
          </span>
        </label>

        <button
          onClick={generate}
          disabled={!consentChecked}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Gerar resumo com IA
        </button>
        <p className="mt-2 text-[10px] text-muted italic">Powered by GPT — {APP_DISCLAIMER}</p>
      </div>
    );
  }

  // Loading (no previous narrative)
  if (loading && !narrative) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          <p className="text-sm text-muted">Analisando seus dados por área...</p>
        </div>
      </div>
    );
  }

  // Error (no previous narrative)
  if (error && !narrative) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button onClick={generate} disabled={retryCooldown} className="mt-2 text-xs text-primary underline disabled:opacity-50 disabled:cursor-not-allowed">
          {retryCooldown ? "Aguarde antes de tentar novamente..." : "Tentar novamente"}
        </button>
      </div>
    );
  }

  if (!narrative) return null;

  // Visible sections (not absent)
  const visibleSections = NARRATIVE_SECTION_KEYS.filter(
    (key) => narrative.sections[key]?.status !== "absent"
  );

  return (
    <div className="rounded-lg border border-border bg-surface" aria-live="polite">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-5"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Resumo inteligente</h3>
          {data?.cached && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">em cache</span>
          )}
          {data?.latestAttemptFailed && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900 dark:text-amber-300">versão anterior</span>
          )}
        </div>
        <svg className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-4 px-5 pb-5">
          {/* Guardrail failure notice (when showing older safe narrative) */}
          {data?.latestAttemptFailed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A narrativa mais recente não pôde ser exibida por não atender aos critérios de segurança.
                Exibindo a versão anterior validada. Você pode tentar gerar uma nova abaixo.
              </p>
            </div>
          )}

          {/* Overview */}
          <div>
            <p className="text-base font-semibold text-foreground">{narrative.overview.headline}</p>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/90">
              {narrative.overview.summary.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {narrative.overview.dataQualityNote && (
              <p className="mt-2 text-xs text-muted italic">{narrative.overview.dataQualityNote}</p>
            )}
          </div>

          {/* Share with professional banner */}
          {narrative.actions.shareWithProfessional && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-200">{SHARE_WITH_PROFESSIONAL_TEXT}</p>
            </div>
          )}

          {/* Sections */}
          {visibleSections.length > 0 && (
            <div className="space-y-2">
              {visibleSections.map((key) => {
                const section = narrative.sections[key];
                if (!section) return null;
                const isOpen = expandedSections.has(key);
                const icon = SECTION_ICONS[key];
                const hasContent = section.summary || section.keyPoints.length > 0 || section.metrics.length > 0;
                const statusColor = section.status === "notable" ? "text-amber-600 dark:text-amber-400"
                  : section.status === "limited" ? "text-muted" : "text-foreground/70";

                return (
                  <div key={key} className="rounded-lg border border-border/50 bg-surface">
                    <button
                      onClick={() => toggleSection(key)}
                      className="flex w-full items-center justify-between p-3"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">{icon}</span>
                        <span className="text-sm font-medium text-foreground">{section.title || SECTION_LABELS[key]}</span>
                        {section.status === "notable" && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">mudança</span>
                        )}
                        {section.status === "limited" && (
                          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-muted dark:bg-gray-800">poucos dados</span>
                        )}
                      </div>
                      <svg className={`h-3.5 w-3.5 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isOpen && hasContent && (
                      <div className="space-y-2 border-t border-border/30 px-3 pb-3 pt-2">
                        {section.summary && (
                          <p className={`text-sm leading-relaxed ${statusColor}`}>{section.summary}</p>
                        )}

                        {section.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {section.metrics.map((m, i) => (
                              <span key={i} className="rounded-md bg-primary/5 px-2 py-1 text-xs text-foreground/80">{m}</span>
                            ))}
                          </div>
                        )}

                        {/* Evidence chips — allowlisted data points that informed this section */}
                        {data?.evidenceMap && section.evidenceIds && section.evidenceIds.length > 0 && (() => {
                          const chips = toPublicEvidence(data.evidenceMap, section.evidenceIds);
                          if (chips.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1.5">
                              {chips.map((ev, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border ${
                                    ev.kind === "alert"
                                      ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300"
                                      : ev.kind === "comparison"
                                      ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300"
                                      : "bg-surface-alt border-border/50 text-foreground/60"
                                  }`}
                                  title={ev.detailText}
                                >
                                  <span className={`inline-block h-1 w-1 rounded-full ${
                                    ev.confidence === "high" ? "bg-emerald-400" : ev.confidence === "medium" ? "bg-amber-400" : "bg-gray-300"
                                  }`} />
                                  {ev.chipText}
                                </span>
                              ))}
                            </div>
                          );
                        })()}

                        {section.keyPoints.length > 0 && (
                          <ul className="space-y-1">
                            {section.keyPoints.map((p, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                                <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-primary/50" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        )}

                        {section.suggestions.length > 0 && (
                          <div className="border-t border-border/20 pt-2">
                            {section.suggestions.map((s, i) => (
                              <p key={i} className="flex items-start gap-1 text-xs text-primary/80">
                                <span className="mt-0.5">→</span> {s}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Practical suggestions */}
          {narrative.actions.practicalSuggestions.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sugestões práticas</h4>
              <ul className="space-y-1">
                {narrative.actions.practicalSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 text-primary">→</span> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Closing */}
          {narrative.closing.text && (
            <p className="text-sm italic text-foreground/60">{narrative.closing.text}</p>
          )}

          {/* Disclaimer + timestamp — source-aware disclosure.
              "fallback" after LLM attempt still means data was sent to OpenAI. */}
          <p className="text-[10px] text-muted italic">
            {narrative.source === "llm" ? "Gerado por IA"
              : narrative.source === "fallback" ? "Processado por IA (resumo indisponível)"
              : "Resumo automático"}
            {narrative.generatedAt && ` em ${new Date(narrative.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
            . {APP_DISCLAIMER}
          </p>

          {/* Feedback buttons */}
          {data?.narrativeId && (
            <div className="flex items-center gap-3 border-t border-border/30 pt-3">
              <span className="text-xs text-muted">Este resumo foi útil?</span>
              <button
                onClick={() => submitFeedback("useful")}
                disabled={feedbackSent !== null}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${feedbackSent === "useful" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-surface hover:bg-primary/5 text-muted border border-border/50"} disabled:cursor-default`}
              >
                {feedbackSent === "useful" ? "Obrigado!" : "Sim"}
              </button>
              <button
                onClick={() => submitFeedback("not_useful")}
                disabled={feedbackSent !== null}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${feedbackSent === "not_useful" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-surface hover:bg-primary/5 text-muted border border-border/50"} disabled:cursor-default`}
              >
                {feedbackSent === "not_useful" ? "Obrigado!" : "Não"}
              </button>
            </div>
          )}

          {/* Inline error on regeneration */}
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          {/* Regenerate button */}
          <button
            onClick={generate}
            disabled={retryCooldown || loading}
            className="text-xs text-primary underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Gerando..." : retryCooldown ? "Aguarde..." : "Gerar novo resumo"}
          </button>
        </div>
      )}
    </div>
  );
}
