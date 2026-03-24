"use client";

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
  if (!narrativeId) return null;

  return (
    <div className="flex items-center gap-3">
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
    </div>
  );
}
