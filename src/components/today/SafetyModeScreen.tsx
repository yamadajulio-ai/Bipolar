/**
 * SafetyModeScreen — RED full-screen for acute safety risk.
 *
 * This is the ONLY place that shows SAMU 192 and simplified UI.
 * Only appears when safety rail = RED (ASQ acute, BSSA imminent, etc.)
 *
 * Based on NIMH ASQ Toolkit disposition: immediate safety evaluation.
 */

"use client";

import Link from "next/link";
import type { PendingAction } from "@/lib/risk-v2/types";
import { DISCLAIMER } from "@/lib/risk-v2/copy";

interface Props {
  actions: PendingAction[];
  /** Allow user to view full dashboard (adds ?full=1) */
  onDismiss?: () => void;
}

export function SafetyModeScreen({ actions, onDismiss }: Props) {
  return (
    <div className="space-y-4" role="region" aria-label="Alerta de segurança — risco agudo detectado">
      {/* Hero */}
      <div className="rounded-[var(--radius-card)] border border-red-700 bg-red-950/50 p-6" role="alert" aria-live="assertive">
        <h2 className="text-lg font-bold text-red-300 mb-2">
          Sua segurança vem primeiro
        </h2>
        <p className="text-sm text-red-200 mb-4">
          Pelos seus registros e respostas, pode haver risco agudo. Procure ajuda agora.
        </p>

        {/* Emergency actions — 192 always first (urgência/emergência), 188 second (apoio emocional) */}
        <nav aria-label="Ações de emergência" className="space-y-2">
          {actions.map((action) => (
            action.phone ? (
              <a
                key={action.id}
                href={`tel:${action.phone}`}
                role="button"
                aria-label={action.id === "call_192"
                  ? "Ligar SAMU 192 — emergência médica e psiquiátrica"
                  : "Ligar CVV 188 — apoio emocional 24 horas"}
                className={`block w-full rounded-lg px-4 py-3 text-sm font-medium text-center transition-colors ${
                  action.id === "call_192"
                    ? "bg-red-700 text-white hover:bg-red-600"
                    : "bg-white/10 text-foreground/80 hover:bg-white/20"
                }`}
              >
                {action.label}
                {action.id === "call_192" && (
                  <span className="block text-xs font-normal mt-0.5 opacity-80">
                    Emergência médica e psiquiátrica
                  </span>
                )}
                {action.id === "call_188" && (
                  <span className="block text-xs font-normal mt-0.5 opacity-80">
                    Apoio emocional 24h — não substitui atendimento de urgência
                  </span>
                )}
              </a>
            ) : action.href ? (
              <Link
                key={action.id}
                href={action.href}
                aria-label={action.label}
                className="block w-full rounded-lg bg-white/10 px-4 py-3 text-sm font-medium text-center text-foreground/80 hover:bg-white/20 transition-colors"
              >
                {action.label}
              </Link>
            ) : null
          ))}
        </nav>

        <div className="mt-4 rounded-lg bg-red-950/30 p-2 text-xs text-red-300/80">
          <p>
            Se não tem profissional de referência: vá ao pronto-socorro ou UPA mais próximo,
            ou ligue 192 (SAMU) para atendimento psiquiátrico de urgência.
          </p>
        </div>
      </div>

      {/* Quick access cards */}
      <div className="space-y-3">
        <Link href="/plano-de-crise" className="block no-underline" aria-label="Revisar plano de crise — seu plano de segurança personalizado">
          <div className="rounded-[var(--radius-card)] border border-red-200 bg-red-50/30 hover:bg-red-50 transition-colors p-5">
            <div className="flex items-center gap-4">
              <span className="text-2xl" aria-hidden="true">&#128737;</span>
              <div>
                <p className="font-semibold text-foreground">Revisar plano de crise</p>
                <p className="text-xs text-muted mt-0.5">Seu plano de segurança personalizado</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/sos" className="block no-underline" aria-label="SOS — preciso de ajuda agora — grounding e contatos de emergência">
          <div className="rounded-[var(--radius-card)] border border-red-300 bg-red-100/50 hover:bg-red-100 transition-colors p-5">
            <div className="flex items-center gap-4">
              <span className="text-2xl" aria-hidden="true">&#127384;</span>
              <div>
                <p className="font-semibold text-red-800">SOS — Preciso de ajuda agora</p>
                <p className="text-xs text-red-700 mt-0.5">Grounding, contatos de emergência, CVV 188</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Dismiss */}
      {onDismiss && (
        <div className="text-center">
          <button
            onClick={onDismiss}
            aria-label="Ver painel completo — fechar tela de segurança"
            className="text-xs text-muted hover:text-foreground underline"
          >
            Ver painel completo
          </button>
        </div>
      )}

      <p className="text-center text-[10px] text-muted" role="note">
        {DISCLAIMER}
      </p>
    </div>
  );
}
