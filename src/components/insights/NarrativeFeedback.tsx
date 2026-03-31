"use client";

import { useState, useCallback } from "react";

interface NarrativeFeedbackProps {
  narrativeId: string | undefined;
  feedbackSent: "useful" | "not_useful" | null;
  onFeedback: (rating: "useful" | "not_useful") => void;
}

export function NarrativeFeedback({
  narrativeId,
  feedbackSent,
  onFeedback,
}: NarrativeFeedbackProps) {
  const [reported, setReported] = useState(false);

  const handleReport = useCallback(async () => {
    if (!narrativeId || reported) return;
    setReported(true);
    try {
      await fetch("/api/insights-narrative/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          narrativeId,
          rating: "not_useful",
          reasonCodes: ["inappropriate_content"],
          comment: "Conteúdo reportado como inadequado pelo usuário",
        }),
      });
    } catch {
      /* silent — report is best-effort */
    }
  }, [narrativeId, reported]);

  if (!narrativeId) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-muted">Este resumo foi útil?</span>
      <button
        onClick={() => onFeedback("useful")}
        disabled={feedbackSent !== null}
        className={`rounded-md px-3 py-1 text-xs transition-colors ${feedbackSent === "useful" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-surface hover:bg-primary/5 text-muted border border-border/50"} disabled:cursor-default`}
      >
        {feedbackSent === "useful" ? "Obrigado!" : "Sim"}
      </button>
      <button
        onClick={() => onFeedback("not_useful")}
        disabled={feedbackSent !== null}
        className={`rounded-md px-3 py-1 text-xs transition-colors ${feedbackSent === "not_useful" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-surface hover:bg-primary/5 text-muted border border-border/50"} disabled:cursor-default`}
      >
        {feedbackSent === "not_useful" ? "Obrigado!" : "Não"}
      </button>
      <span className="text-border/50" aria-hidden="true">|</span>
      {reported ? (
        <span className="text-[11px] text-muted">
          Reportado — obrigado
        </span>
      ) : (
        <button
          onClick={handleReport}
          className="text-[11px] text-muted hover:text-danger-fg transition-colors"
          aria-label="Reportar conteúdo inadequado gerado pela IA"
        >
          Reportar conteúdo inadequado
        </button>
      )}
    </div>
  );
}
