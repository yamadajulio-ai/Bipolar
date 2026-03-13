"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "install-banner-dismissed";
const VISIT_KEY = "install-banner-visits";
const DISMISS_DAYS = 30;
const MIN_VISITS = 2;

export function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only show on iOS Safari, not already installed
    if (!isIOSSafari() || isStandalone()) return;

    // Check dismissal
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = Number(dismissed);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Track visits, show after MIN_VISITS
    const visits = Number(localStorage.getItem(VISIT_KEY) || "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));
    if (visits >= MIN_VISITS) {
      setShow(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-sm rounded-lg border border-border bg-surface p-4 shadow-lg"
      role="status"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-foreground">
          <p className="font-medium">Instale o Suporte Bipolar</p>
          <p className="mt-1 text-muted">
            Toque em{" "}
            <svg
              className="inline-block h-4 w-4 align-text-bottom"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>{" "}
            e depois em &quot;Adicionar à Tela de Início&quot;.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 rounded p-1 text-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
