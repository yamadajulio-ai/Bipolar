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

  const borderColor = isOrange ? "border-orange-400" : "border-amber-300";
  const bgColor = isOrange ? "bg-orange-50" : "bg-amber-50";
  const headlineColor = isOrange ? "text-orange-900" : "text-amber-900";
  const textColor = isOrange ? "text-orange-800" : "text-amber-800";
  const reasonBg = isOrange ? "bg-orange-100/50" : "bg-amber-100/50";
  const reasonText = isOrange ? "text-orange-700" : "text-amber-700";

  // ORANGE = clinical urgency (role="alert"), YELLOW = monitoring (role="status")
  const semanticRole = isOrange ? "alert" : "status";
  const ariaLive = isOrange ? "assertive" as const : "polite" as const;

  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} p-5 shadow-sm`}
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
              className={`block w-full rounded-lg px-4 py-2.5 text-sm font-medium text-center transition-colors ${
                action.variant === "warning"
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "bg-white/60 text-foreground hover:bg-white"
              }`}
            >
              {action.label}
            </a>
          ) : action.href ? (
            <Link
              key={action.id}
              href={action.href}
              aria-label={action.label}
              className={`block w-full rounded-lg px-4 py-2.5 text-sm font-medium text-center transition-colors ${
                action.variant === "warning"
                  ? "border border-orange-300 bg-white text-orange-800 hover:bg-orange-50"
                  : "border border-border bg-white text-foreground hover:bg-surface"
              }`}
            >
              {action.label}
            </Link>
          ) : null
        ))}
      </nav>

      <p className="mt-3 text-[10px] text-muted" role="note">
        {DISCLAIMER_SHORT}
      </p>
    </div>
  );
}
