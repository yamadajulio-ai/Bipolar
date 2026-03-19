"use client";

import { useState, useRef, useEffect } from "react";

interface NarrativeData {
  summary: string;
  highlights: string[];
  suggestions: string[];
  generatedAt: string;
}

export function NarrativeSection() {
  const [narrative, setNarrative] = useState<NarrativeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [retryCooldown, setRetryCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup timer + abort in-flight fetch on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
      abortRef.current?.abort();
    };
  }, []);

  async function generate() {
    if (retryCooldown) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/insights-narrative", {
        method: "POST",
        signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erro ao gerar narrativa");
      }
      const data: NarrativeData = await res.json();
      setNarrative(data);
      setRetryCount(0); // Reset backoff on success
    } catch (err) {
      // Don't clear previous narrative on regeneration error — show inline
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      // Exponential backoff: 5s, 10s, 20s, 30s max
      const delay = Math.min(5000 * Math.pow(2, retryCount), 30_000);
      setRetryCount((c) => c + 1);
      setRetryCooldown(true);
      cooldownTimer.current = setTimeout(() => setRetryCooldown(false), delay);
    } finally {
      setLoading(false);
    }
  }

  // Not generated yet — show CTA button
  if (!narrative && !loading && !error) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center">
        <p className="mb-1 text-sm font-semibold text-foreground">
          Resumo inteligente
        </p>
        <p className="mb-4 text-xs text-muted">
          A IA analisa seus dados de sono, humor e ritmos dos últimos 30 dias para gerar uma
          interpretação personalizada. Ao clicar, seus dados são enviados de forma segura à
          OpenAI (GPT) exclusivamente para gerar este resumo. A OpenAI não usa dados
          da API para treinar modelos.
        </p>
        <button
          onClick={generate}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark"
        >
          Gerar resumo com IA
        </button>
        <p className="mt-2 text-[10px] text-muted italic">
          Powered by GPT — não substitui avaliação profissional
        </p>
      </div>
    );
  }

  // Loading state (only show standalone spinner if no previous narrative)
  if (loading && !narrative) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Analisando seus dados...</p>
        </div>
      </div>
    );
  }

  // Error state (only show full error if no previous narrative exists)
  if (error && !narrative) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={generate}
          disabled={retryCooldown}
          className="mt-2 text-xs text-primary underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retryCooldown ? "Aguarde antes de tentar novamente..." : "Tentar novamente"}
        </button>
      </div>
    );
  }

  // Narrative rendered
  if (!narrative) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
        aria-expanded={expanded}
      >
        <h3 className="text-sm font-semibold text-foreground">
          Resumo inteligente
        </h3>
        <svg
          className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Summary paragraphs */}
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {narrative.summary.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Highlights */}
          {narrative.highlights.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Pontos-chave
              </h4>
              <ul className="space-y-1">
                {narrative.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {narrative.suggestions.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Sugestões
              </h4>
              <ul className="space-y-1">
                {narrative.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <span className="mt-0.5 text-primary">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-muted italic">
            Gerado por IA em{" "}
            {new Date(narrative.generatedAt).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Esta análise é educacional e não substitui avaliação profissional.
          </p>

          {/* Inline error when regeneration fails */}
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

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
