"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "sb_disclaimer_accepted";

/**
 * First-open medical disclaimer modal.
 * Shows once on public/auth pages (login, cadastro) — stored in localStorage.
 * Required for App Store review: reviewer sees disclaimer before onboarding.
 * Accessible: role="dialog", aria-modal, auto-focus on accept button.
 */
export function MedicalDisclaimer() {
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) — show disclaimer
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      buttonRef.current?.focus();
    }
  }, [visible]);

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Silently fail — modal won't reappear this session
    }
    setVisible(false);
  }

  // Dismiss on Escape key
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      handleAccept();
    }
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md rounded-[var(--radius-panel)] bg-[var(--surface)] p-6 shadow-[var(--shadow-float)]">
        <h2
          id="disclaimer-title"
          className="mb-4 text-center text-lg font-bold text-[var(--foreground)]"
        >
          Aviso Importante / Important Notice
        </h2>

        <div className="space-y-3 text-sm text-[var(--muted)]">
          <p>
            Este app é uma ferramenta de automonitoramento e{" "}
            <strong className="text-[var(--foreground)]">
              NÃO substitui avaliação médica profissional
            </strong>
            . Não faz diagnóstico e não prescreve tratamento.
          </p>

          <p className="italic">
            This app is a self-monitoring tool and does NOT replace professional
            medical evaluation.
          </p>

          <p className="text-center font-medium text-[var(--danger-fg)]">
            Em caso de emergência, ligue{" "}
            <strong>192</strong> (SAMU) ou{" "}
            <strong>188</strong> (CVV)
          </p>
        </div>

        <button
          ref={buttonRef}
          onClick={handleAccept}
          className="mt-6 w-full rounded-lg bg-[var(--primary)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
          style={{ minHeight: 44 }}
        >
          Entendi / I Understand
        </button>
      </div>
    </div>
  );
}
