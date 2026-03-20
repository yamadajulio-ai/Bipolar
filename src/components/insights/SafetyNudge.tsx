"use client";

/**
 * SafetyNudge — shown when PHQ-9 item 9 >= 1, risk score is high,
 * or bipolar-specific triggers are detected (mixed state, sleep
 * deprivation, agitation/impulsivity).
 *
 * Emergency resources are tiered per Brazilian health system:
 * - SAMU 192 = emergência/risco imediato
 * - CVV 188 = escuta e apoio emocional 24h
 * - CAPS/UBS = cuidado continuado
 *
 * Based on Columbia Protocol guidelines for digital tools.
 */

interface Props {
  /** PHQ-9 item 9 score (0-3) — thoughts of self-harm */
  phq9Item9?: number | null;
  /** Risk level from computeInsights */
  riskLevel?: "ok" | "atencao" | "atencao_alta" | null;
  /** Whether to show compact version (inline) vs full */
  compact?: boolean;
  /** Bipolar-specific context signals from computeInsights */
  bipolarContext?: {
    /** Mixed features detected (mania + depression overlap) */
    mixedFeatures?: boolean;
    /** Strength of mixed signal */
    mixedStrength?: "forte" | "provavel" | null;
    /** Consecutive nights with < 6h sleep (currentStreak) */
    consecutiveShortSleep?: number;
    /** Recent mania-related warning signs active */
    maniaSignsActive?: string[];
    /** Risk factors from computeInsights */
    riskFactors?: string[];
  } | null;
}

type UrgencyLevel = "emergencia" | "atencao" | "cuidado";

function getUrgencyLevel(
  phq9Item9: number | null | undefined,
  riskLevel: string | null | undefined,
  bipolarContext: Props["bipolarContext"],
): UrgencyLevel {
  // Emergency: active suicidal ideation (PHQ-9 item 9 >= 2) or very high risk
  if (phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 2) return "emergencia";
  if (riskLevel === "atencao_alta") return "emergencia";

  // Emergency: strong mixed state (high M + D simultaneously — most dangerous bipolar state)
  if (bipolarContext?.mixedFeatures && bipolarContext.mixedStrength === "forte") return "emergencia";

  // Attention: moderate signals — PHQ-9 item 9 = 1, probable mixed, or severe sleep deprivation
  if (phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 1) return "atencao";
  if (bipolarContext?.mixedFeatures) return "atencao";
  if (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) return "atencao";

  // Attention: multiple mania signs (agitation, impulsivity, racing thoughts)
  if (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2) return "atencao";

  return "cuidado";
}

function getHeadline(urgency: UrgencyLevel, bipolarContext: Props["bipolarContext"]): string {
  if (urgency === "emergencia") {
    return "Percebemos que você pode estar passando por um momento difícil";
  }

  // Bipolar-specific headlines
  if (bipolarContext?.mixedFeatures) {
    return "Seus registros mostram sinais mistos que merecem atenção";
  }
  if (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) {
    return `${bipolarContext.consecutiveShortSleep} noites curtas seguidas — atenção ao seu padrão de sono`;
  }
  if (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2) {
    return "Seus registros recentes mostram sinais de ativação que merecem atenção";
  }

  return "Cuidando de você";
}

function getDescription(urgency: UrgencyLevel, bipolarContext: Props["bipolarContext"]): string {
  if (urgency === "emergencia") {
    return "Se você está tendo pensamentos de se machucar, saiba que existem pessoas prontas para ajudar — 24 horas, todos os dias.";
  }

  if (bipolarContext?.mixedFeatures) {
    return "Quando sinais de ativação e rebaixamento aparecem juntos, o desconforto pode ser intenso. Conversar com seu profissional pode ajudar a entender o que está acontecendo.";
  }
  if (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) {
    return "Privação de sono pode afetar significativamente o humor e a estabilidade. Converse com seu profissional sobre seu padrão de sono.";
  }
  if (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2) {
    return "Sinais como pensamentos acelerados, energia excessiva ou impulsividade merecem acompanhamento. Conversar com seu profissional pode ajudar.";
  }

  return "Seus registros recentes mostram sinais que merecem atenção. Conversar com alguém pode ajudar.";
}

export function SafetyNudge({ phq9Item9, riskLevel, compact, bipolarContext }: Props) {
  const showForPhq9 = phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 1;
  const showForRisk = riskLevel === "atencao_alta";
  const showForBipolar = !!(
    bipolarContext?.mixedFeatures ||
    (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) ||
    (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2)
  );

  if (!showForPhq9 && !showForRisk && !showForBipolar) return null;

  const urgency = getUrgencyLevel(phq9Item9, riskLevel, bipolarContext);
  const isUrgent = urgency === "emergencia";
  const liveRole = isUrgent ? "alert" as const : "status" as const;

  if (compact) {
    return (
      <div
        role={liveRole}
        className={`rounded-lg p-3 text-sm ${
          isUrgent
            ? "border border-red-700 bg-red-950/50 text-red-200"
            : "border border-amber-700 bg-amber-950/50 text-amber-200"
        }`}
      >
        <p className="font-medium">
          {isUrgent
            ? "Se precisar de ajuda agora:"
            : "Lembre-se: você não está sozinho."}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {isUrgent && (
            <a
              href="tel:192"
              className="inline-flex items-center rounded-full bg-red-700/50 px-3 py-1 text-xs font-medium hover:bg-red-700/70"
            >
              SAMU 192
            </a>
          )}
          <a
            href="tel:188"
            className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
          >
            CVV 188
          </a>
          <a
            href="/sos"
            className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
          >
            SOS
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      role={liveRole}
      className={`rounded-xl p-5 ${
        isUrgent
          ? "border border-red-700 bg-red-950/50"
          : "border border-amber-700 bg-amber-950/50"
      }`}
    >
      <h3
        className={`mb-2 text-sm font-semibold ${
          isUrgent ? "text-red-300" : "text-amber-300"
        }`}
      >
        {getHeadline(urgency, bipolarContext)}
      </h3>

      <p className={`mb-3 text-sm ${isUrgent ? "text-red-200" : "text-amber-200"}`}>
        {getDescription(urgency, bipolarContext)}
      </p>

      {/* Tiered emergency resources — differentiated per Brazilian health system */}
      <div className="space-y-2">
        {/* Tier 1: Emergency — SAMU 192 (shown for urgent/emergency level) */}
        {isUrgent && (
          <div className="flex flex-wrap gap-2">
            <a
              href="tel:192"
              className="inline-flex items-center rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              SAMU 192 — Emergência
            </a>
          </div>
        )}

        {/* Tier 2: Emotional support — CVV 188 (always shown) */}
        <div className="flex flex-wrap gap-2">
          <a
            href="tel:188"
            className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${
              isUrgent
                ? "bg-white/10 text-gray-200 hover:bg-white/20"
                : "bg-amber-700 text-white hover:bg-amber-600"
            }`}
          >
            CVV 188 — Escuta e apoio 24h
          </a>
          <a
            href="/sos"
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/20"
          >
            Abrir SOS
          </a>
          <a
            href="/plano-de-crise"
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-white/20"
          >
            Meu plano de crise
          </a>
        </div>

        {/* Tier 3: Continued care — CAPS/UBS (shown for non-emergency attention) */}
        {urgency !== "emergencia" && (
          <p className={`text-xs ${isUrgent ? "text-red-300/70" : "text-amber-300/70"}`}>
            Para acompanhamento continuado, procure o CAPS ou UBS mais próximo.
          </p>
        )}
      </div>

      <p className="mt-3 text-[10px] text-muted">
        Este aplicativo não substitui avaliação profissional. Em emergência, ligue 192 (SAMU).
      </p>
    </div>
  );
}
