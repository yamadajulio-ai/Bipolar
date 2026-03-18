"use client";

import { useState } from "react";

interface Props {
  contextKey: string;
  question?: string;
}

export function ContextualFeedbackButtons({
  contextKey,
  question = "Este conteúdo foi útil?",
}: Props) {
  const [sent, setSent] = useState<boolean | null>(null);

  async function send(useful: boolean) {
    setSent(useful);
    fetch("/api/feedback/contextual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contextKey, useful }),
    }).catch(() => {});
  }

  if (sent !== null) {
    return (
      <p className="mt-3 text-xs text-muted" role="status" aria-live="polite">
        {sent ? "Obrigado pelo feedback!" : "Entendido, vamos melhorar."}
      </p>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-xs text-muted">{question}</span>
      <button
        onClick={() => send(true)}
        className="rounded border border-green-300 px-2 py-0.5 text-xs text-green-700 hover:bg-green-50 transition-colors"
        aria-label="Sim, foi útil"
      >
        Sim
      </button>
      <button
        onClick={() => send(false)}
        className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 transition-colors"
        aria-label="Não, não foi útil"
      >
        Não
      </button>
    </div>
  );
}
