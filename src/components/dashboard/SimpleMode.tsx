"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";

const LS_KEY = "simple-mode";

// Listeners for useSyncExternalStore
let listeners: Array<() => void> = [];
function subscribe(cb: () => void) {
  listeners = [...listeners, cb];
  return () => { listeners = listeners.filter((l) => l !== cb); };
}
function getSnapshot(): boolean {
  try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
}
function getServerSnapshot(): boolean {
  return false;
}
function setSimpleMode(value: boolean) {
  try {
    if (value) localStorage.setItem(LS_KEY, "1");
    else localStorage.removeItem(LS_KEY);
  } catch { /* noop */ }
  listeners.forEach((l) => l());
}

/**
 * SimpleMode — a low-energy, minimal dashboard view.
 * Activated manually via toggle (persisted in localStorage) or automatically
 * when crisis mode is active (server passes `forceCrisis`).
 *
 * Shows only: current status summary, SOS button (large), primary check-in action,
 * and a toggle to return to the full dashboard.
 */
export function SimpleMode({
  forceCrisis,
  statusText,
  children,
}: {
  /** When true, simple mode is forced on by server-side crisis detection */
  forceCrisis?: boolean;
  /** One-sentence status to show in simple mode (e.g. "Hoje: humor estavel, sono OK") */
  statusText?: string;
  /** Full dashboard content (rendered when simple mode is off) */
  children: React.ReactNode;
}) {
  const manualSimple = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Force re-render key for immediate toggle feedback
  const [, setTick] = useState(0);
  const toggle = useCallback((value: boolean) => {
    setSimpleMode(value);
    setTick((t) => t + 1);
  }, []);

  const isSimple = forceCrisis || manualSimple;

  if (!isSimple) {
    return (
      <>
        {/* Toggle to enter simple mode — subtle, at the top */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => toggle(true)}
            className="text-xs text-muted hover:text-foreground transition-colors"
            aria-label="Ativar modo simples"
          >
            Modo simples
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Status */}
      <div className="text-center space-y-2 px-4">
        <p className="text-lg text-foreground leading-relaxed">
          {statusText || "Voce esta no modo simples."}
        </p>
        <p className="text-sm text-muted">
          Apenas o essencial, sem pressao.
        </p>
      </div>

      {/* Primary action: check-in */}
      <Link
        href="/checkin"
        className="block w-full rounded-xl bg-primary text-white text-center py-5 text-lg font-medium hover:bg-primary-dark transition-colors no-underline shadow-sm"
      >
        Registrar como estou
      </Link>

      {/* SOS button */}
      <Link
        href="/sos"
        className="block w-full rounded-xl bg-danger text-on-danger text-center py-5 text-lg font-medium hover:bg-danger/90 transition-colors no-underline shadow-sm"
      >
        SOS — Preciso de ajuda
      </Link>

      {/* Medication shortcut */}
      <Link
        href="/checkin"
        className="block w-full rounded-xl border-2 border-border bg-surface text-foreground text-center py-4 text-base font-medium hover:bg-surface-alt transition-colors no-underline"
      >
        Registrar medicacao
      </Link>

      {/* Toggle back */}
      <button
        onClick={() => toggle(false)}
        className="block w-full text-sm text-muted underline text-center py-2 hover:text-foreground transition-colors"
      >
        Ver painel completo
      </button>

      <p className="text-[11px] text-center text-muted italic px-6">
        O modo simples reduz a interface ao essencial.
        Voce pode voltar ao painel completo a qualquer momento.
      </p>
    </div>
  );
}
