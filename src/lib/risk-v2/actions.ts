/**
 * Risk v2 — Pending Actions
 *
 * Builds the list of CTAs for each alert layer.
 * Resources follow Brazilian health system tiers:
 * - SAMU 192: emergency only (RED)
 * - CVV 188: emotional support 24h (ORANGE+)
 * - CAPS/UBS: community care (all levels)
 */

import type { AlertLayer, RailResult, PendingAction } from "./types";

export function buildActions(
  layer: AlertLayer,
  safety: RailResult,
  syndrome: RailResult,
  prodrome: RailResult,
): PendingAction[] {
  const actions: PendingAction[] = [];

  if (layer === "RED") {
    actions.push(
      { id: "call_192", label: "Ligar SAMU 192", phone: "192", priority: 0, variant: "danger" },
      { id: "call_188", label: "Ligar CVV 188", phone: "188", priority: 1, variant: "danger" },
      { id: "notify_support_contact", label: "Avisar contato de apoio", href: "/plano-de-crise", priority: 2, variant: "danger" },
      { id: "open_crisis_plan", label: "Abrir plano de crise", href: "/plano-de-crise", priority: 3, variant: "danger" },
    );
    return actions;
  }

  if (layer === "ORANGE") {
    // Safety screen pending?
    if (safety.pending) {
      actions.push(
        { id: "open_safety_screen", label: "Completar triagem de segurança", href: "/hoje?safety=1", priority: 0, variant: "warning" },
      );
    }

    actions.push(
      { id: "open_crisis_plan", label: "Revisar plano de crise", href: "/plano-de-crise", priority: 1, variant: "warning" },
      { id: "call_188", label: "Ligar CVV 188", phone: "188", priority: 2, variant: "warning" },
      { id: "contact_caps", label: "Procurar CAPS / serviço de referência", href: "/perfil", priority: 3, variant: "warning" },
      { id: "notify_support_contact", label: "Avisar contato de apoio", href: "/plano-de-crise", priority: 4, variant: "warning" },
      { id: "repeat_checkin", label: "Registrar novo check-in", href: "/checkin", priority: 5, variant: "neutral" },
    );

    return actions;
  }

  if (layer === "YELLOW") {
    actions.push(
      { id: "repeat_checkin", label: "Refazer check-in mais tarde", href: "/checkin", priority: 0, variant: "neutral" },
      { id: "review_wellness_plan", label: "Ver plano de bem-estar", href: "/plano-de-crise", priority: 1, variant: "neutral" },
    );

    if (syndrome.reasons.length > 0 || prodrome.reasons.some((r) => r.includes("medicacao"))) {
      actions.push(
        { id: "update_weekly_assessment", label: "Atualizar avaliação semanal", href: "/avaliacao-semanal", priority: 2, variant: "neutral" },
      );
    }

    return actions;
  }

  // CLEAR — no actions
  return actions;
}
