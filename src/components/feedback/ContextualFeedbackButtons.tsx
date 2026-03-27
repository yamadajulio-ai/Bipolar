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
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [useful, setUseful] = useState<boolean | null>(null);

  async function send(value: boolean) {
    setStatus("pending");
    setUseful(value);
    try {
      const res = await fetch("/api/feedback/contextual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextKey, useful: value }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
    } catch {
      setStatus("error");
      setUseful(null);
    }
  }

  if (status === "sent" && useful !== null) {
    return (
      <p className="mt-3 text-xs text-muted" role="status" aria-live="polite">
        {useful ? "Obrigado pelo feedback!" : "Entendido, vamos melhorar."}
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="mt-3 flex items-center gap-2" role="alert">
        <span className="text-xs text-red-600">Não foi possível enviar.</span>
        <button
          onClick={() => setStatus("idle")}
          className="text-xs text-primary underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <fieldset className="mt-3 border-0 p-0 m-0" disabled={status === "pending"}>
      <legend className="text-xs text-muted mb-1">{question}</legend>
      <div className="flex items-center gap-2">
        <button
          onClick={() => send(true)}
          disabled={status === "pending"}
          className="min-h-[44px] min-w-[48px] rounded border border-green-300 px-3 py-1 text-sm text-green-700 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 transition-colors disabled:opacity-50"
          aria-label="Sim, foi útil"
        >
          {status === "pending" && useful === true ? "..." : "Sim"}
        </button>
        <button
          onClick={() => send(false)}
          disabled={status === "pending"}
          className="min-h-[44px] min-w-[48px] rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 transition-colors disabled:opacity-50"
          aria-label="Não, não foi útil"
        >
          {status === "pending" && useful === false ? "..." : "Não"}
        </button>
      </div>
    </fieldset>
  );
}
