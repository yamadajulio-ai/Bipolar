/**
 * AlertCard — YELLOW and ORANGE alert cards for /hoje.
 *
 * YELLOW: amber, discrete, monitoring-level.
 * ORANGE: orange, persistent, clinical urgency level.
 *
 * Never shows SAMU 192 (that's SafetyModeScreen for RED only).
 */

"use client";

import Link from "next/link";
import type { AlertLayer, PendingAction, RailResult } from "@/lib/risk-v2/types";
import { getHeadline, getDescription, reasonToLabel, DISCLAIMER_SHORT } from "@/lib/risk-v2/copy";

interface Props {
  layer: "YELLOW" | "ORANGE";
  reasons: string[];
  actions: PendingAction[];
  safety: RailResult;
  syndrome: RailResult;
  prodrome: RailResult;
}

export function AlertCard({ layer, reasons, actions, safety, syndrome }: Props) {
  const isOrange = layer === "ORANGE";
  const headline = getHeadline(layer, safety, syndrome);
  const description = getDescription(layer, safety, syndrome);

  const borderColor = isOrange ? "border-orange-400 dark:border-orange-700" : "border-amber-300 dark:border-amber-700";
  const bgColor = isOrange ? "bg-orange-50 dark:bg-orange-950/50" : "bg-amber-50 dark:bg-amber-950/50";
  const headlineColor = isOrange ? "text-orange-900 dark:text-orange-200" : "text-amber-900 dark:text-amber-200";
  const textColor = isOrange ? "text-orange-800 dark:text-orange-200" : "text-amber-800 dark:text-amber-200";
  const reasonBg = isOrange ? "bg-orange-100/50 dark:bg-orange-900/30" : "bg-amber-100/50 dark:bg-amber-900/30";
  const reasonText = isOrange ? "text-orange-700 dark:text-orange-300" : "text-amber-700 dark:text-amber-300";

  // ORANGE = clinical urgency (role="alert"), YELLOW = monitoring (role="status")
  const semanticRole = isOrange ? "alert" : "status";
  const ariaLive = isOrange ? "assertive" as const : "polite" as const;

  return (
    <div
      className={`rounded-[var(--radius-card)] border ${borderColor} ${bgColor} p-5 shadow-[var(--shadow-card)]`}
      role={semanticRole}
      aria-live={ariaLive}
      aria-label={headline}
    >
      <h3 className={`text-sm font-semibold ${headlineColor} mb-2`}>
        {headline}
      </h3>

      <p className={`text-sm ${textColor} mb-3`}>
        {description}
      </p>

      {/* Reasons */}
      {reasons.length > 0 && (
        <div className={`rounded-lg ${reasonBg} p-3 mb-3`} role="list" aria-label="Sinais detectados">
          <ul className="space-y-1">
            {reasons.map((r, i) => (
              <li key={i} className={`text-xs ${reasonText}`} role="listitem">
                {reasonToLabel(r)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <nav aria-label="Ações recomendadas" className="space-y-2">
        {actions.map((action) => (
          action.phone ? (
            <a
              key={action.id}
              href={`tel:${action.phone}`}
              role="button"
              aria-label={action.id === "call_188"
                ? "Ligar CVV 188 — apoio emocional 24 horas"
                : action.label}
              className={`block w-full rounded-lg px-4 py-3 min-h-[44px] text-sm font-medium text-center transition-colors ${
                action.variant === "warning"
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "bg-white/60 dark:bg-white/10 text-foreground hover:bg-white dark:hover:bg-white/20"
              }`}
            >
              {action.label}
            </a>
          ) : action.href ? (
            <Link
              key={action.id}
              href={action.href}
              aria-label={action.label}
              className={`block w-full rounded-lg px-4 py-3 min-h-[44px] text-sm font-medium text-center transition-colors ${
                action.variant === "warning"
                  ? "border border-orange-300 dark:border-orange-700 bg-white dark:bg-orange-950/40 text-orange-800 dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-900/40"
                  : "border border-border bg-white dark:bg-surface text-foreground hover:bg-surface dark:hover:bg-surface-alt"
              }`}
            >
              {action.label}
            </Link>
          ) : null
        ))}
      </nav>

      <p className="mt-3 text-[11px] text-muted" role="note">
        {DISCLAIMER_SHORT}
      </p>
    </div>
  );
}
