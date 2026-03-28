"use client";

import { useState, useCallback } from "react";
import type { NarrativeResultV2 } from "@/lib/ai/narrative-types";
import {
  NARRATIVE_SECTION_KEYS,
  SECTION_LABELS,
  SECTION_ICONS,
} from "@/lib/ai/narrative-types";
import { toPublicEvidence } from "@/lib/ai/public-evidence";
import type { NarrativeResponse } from "./useNarrative";
import { NarrativeProgress } from "./NarrativeProgress";

// ── Externalized deterministic phrases ─────────────────────────
const SHARE_WITH_PROFESSIONAL_TEXT =
  "Pode ser interessante compartilhar esses dados com seu profissional de referência.";
const APP_DISCLAIMER =
  "Esta análise é apenas educacional — não é um diagnóstico médico e não substitui avaliação profissional. O app é uma ferramenta de acompanhamento.";

interface NarrativeDisplayProps {
  narrative: NarrativeResultV2;
  data: NarrativeResponse;
  onRefresh?: () => void;
  refreshLoading?: boolean;
  refreshCooldown?: boolean;
}

export { APP_DISCLAIMER };

export function NarrativeDisplay({ narrative, data, onRefresh, refreshLoading, refreshCooldown }: NarrativeDisplayProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(),
  );
  const [evidenceOpen, setEvidenceOpen] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleEvidence = useCallback((key: string) => {
    setEvidenceOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Visible sections (not absent), sorted: notable first, then stable, then limited
  const visibleSections = NARRATIVE_SECTION_KEYS.filter(
    (key) => narrative.sections[key]?.status !== "absent",
  ).sort((a, b) => {
    const order = { notable: 0, stable: 1, limited: 2 };
    const sa =
      order[narrative.sections[a]?.status as keyof typeof order] ?? 3;
    const sb =
      order[narrative.sections[b]?.status as keyof typeof order] ?? 3;
    return sa - sb;
  });

  return (
    <div
      className="rounded-lg border border-border bg-surface"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex w-full items-center justify-between p-5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0"
          aria-expanded={expanded}
        >
          <h3 className="text-sm font-semibold text-foreground">
            Resumo inteligente
          </h3>
          {data?.latestAttemptFailed && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              versão anterior
            </span>
          )}
          <svg
            className={`h-4 w-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {onRefresh && (
          <button
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            disabled={refreshCooldown || refreshLoading}
            className="shrink-0 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            {refreshLoading ? "Gerando..." : refreshCooldown ? "Aguarde..." : "Atualizar"}
          </button>
        )}
      </div>

      {/* Progress bar when refreshing */}
      {refreshLoading && (
        <div className="px-5">
          <NarrativeProgress active />
        </div>
      )}

      {expanded && (
        <div className="space-y-4 px-5 pb-5">
          {/* Guardrail failure notice */}
          {data?.latestAttemptFailed && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                A narrativa mais recente não pôde ser exibida. Exibindo a
                versão anterior validada.
              </p>
            </div>
          )}

          {/* 1. Headline — strong, factual */}
          <div>
            <p className="text-lg font-bold text-foreground leading-snug">
              {narrative.overview.headline}
            </p>
          </div>

          {/* 2. Summary */}
          <div className="space-y-2 text-sm leading-relaxed text-foreground/90">
            {narrative.overview.summary.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* 3. Practical suggestions — CTA block, high visibility */}
          {narrative.actions.practicalSuggestions.length > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
                O que vale fazer agora
              </h4>
              <ul className="space-y-2">
                {narrative.actions.practicalSuggestions.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-foreground/90"
                  >
                    <span className="mt-0.5 text-primary font-bold">
                      →
                    </span>{" "}
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Share with professional banner */}
          {narrative.actions.shareWithProfessional && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {SHARE_WITH_PROFESSIONAL_TEXT}
              </p>
            </div>
          )}

          {/* 4. Sections — notable first, only non-absent */}
          {visibleSections.length > 0 && (
            <div className="space-y-2">
              {visibleSections.map((key) => {
                const section = narrative.sections[key];
                if (!section) return null;
                const isOpen = expandedSections.has(key);
                const icon = SECTION_ICONS[key];
                const hasContent =
                  section.summary ||
                  section.keyPoints.length > 0 ||
                  section.metrics.length > 0;
                const isNotable = section.status === "notable";

                return (
                  <div
                    key={key}
                    className={`rounded-lg border bg-surface ${isNotable ? "border-amber-200 dark:border-amber-800" : "border-border/50"}`}
                  >
                    <button
                      onClick={() => toggleSection(key)}
                      className="flex w-full items-center justify-between p-3"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base" aria-hidden="true">
                          {icon}
                        </span>
                        <span
                          className={`text-sm font-medium ${isNotable ? "text-amber-800 dark:text-amber-200" : "text-foreground"}`}
                        >
                          {SECTION_LABELS[key]}
                        </span>
                        {isNotable && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            mudou
                          </span>
                        )}
                        {section.status === "limited" && (
                          <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[11px] text-muted dark:bg-surface-raised">
                            poucos dados
                          </span>
                        )}
                      </div>
                      <svg
                        className={`h-3.5 w-3.5 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isOpen && hasContent && (
                      <div className="space-y-2 border-t border-border/30 px-3 pb-3 pt-2">
                        {section.summary && (
                          <p className="text-sm leading-relaxed text-foreground/80">
                            {section.summary}
                          </p>
                        )}

                        {section.keyPoints.length > 0 && (
                          <ul className="space-y-1">
                            {section.keyPoints.map((p, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-foreground/70"
                              >
                                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/60" />
                                {p}
                              </li>
                            ))}
                          </ul>
                        )}

                        {section.metrics.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {section.metrics.map((m, i) => (
                              <span
                                key={i}
                                className="rounded-md bg-primary/5 px-2 py-1 text-xs text-foreground/80"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}

                        {section.suggestions.length > 0 && (
                          <div className="border-t border-border/20 pt-2">
                            {section.suggestions.map((s, i) => (
                              <p
                                key={i}
                                className="flex items-start gap-1 text-xs text-primary/80"
                              >
                                <span className="mt-0.5">→</span> {s}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Evidence details — disclosure */}
                        {data?.evidenceMap &&
                          section.evidenceIds &&
                          section.evidenceIds.length > 0 &&
                          (() => {
                            const chips = toPublicEvidence(
                              data.evidenceMap,
                              section.evidenceIds,
                            );
                            if (chips.length === 0) return null;
                            const isEvidenceOpen = evidenceOpen.has(key);
                            return (
                              <div className="border-t border-border/20 pt-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleEvidence(key);
                                  }}
                                  className="text-[11px] text-muted hover:text-foreground/70 underline"
                                >
                                  {isEvidenceOpen
                                    ? "Ocultar detalhes"
                                    : "De onde saiu isso?"}
                                </button>
                                {isEvidenceOpen && (
                                  <div className="mt-2 space-y-1.5">
                                    {chips.map((ev, i) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-2 text-[11px] text-foreground/60"
                                      >
                                        <span
                                          className={`mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                                            ev.kind === "alert"
                                              ? "bg-amber-400"
                                              : ev.kind === "comparison"
                                                ? "bg-blue-400"
                                                : "bg-border"
                                          }`}
                                        />
                                        <div>
                                          <span>{ev.chipText}</span>
                                          {ev.detailText &&
                                            ev.detailText !== ev.chipText && (
                                              <span className="text-muted ml-1">
                                                — {ev.detailText}
                                              </span>
                                            )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Closing */}
          {narrative.closing.text && (
            <p className="text-sm italic text-foreground/50">
              {narrative.closing.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
