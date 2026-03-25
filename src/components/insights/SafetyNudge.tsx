"use client";

/**
 * SafetyNudge — shown on /insights and /avaliacao-semanal when
 * PHQ-9 item 9 >= 1 or bipolar-specific triggers are detected.
 *
 * POST risk-v2 migration:
 * - "emergencia" level REMOVED — SAMU 192 is now exclusive to SafetyModeScreen (RED).
 * - Only "atencao" (CVV 188) and "cuidado" (CAPS/UBS) remain.
 * - PHQ-9 item 9 positive links user to safety screening on /hoje.
 *
 * Based on ASQ Toolkit guidelines for digital tools.
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

type UrgencyLevel = "atencao" | "cuidado";

function getUrgencyLevel(
  phq9Item9: number | null | undefined,
  riskLevel: string | null | undefined,
  bipolarContext: Props["bipolarContext"],
): UrgencyLevel {
  // Attention: PHQ-9 item 9 positive, high risk, mixed state, severe sleep deprivation
  if (phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 1) return "atencao";
  if (riskLevel === "atencao_alta") return "atencao";
  if (bipolarContext?.mixedFeatures) return "atencao";
  if (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) return "atencao";
  if (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2) return "atencao";

  return "cuidado";
}

function getHeadline(urgency: UrgencyLevel, bipolarContext: Props["bipolarContext"]): string {
  if (bipolarContext?.mixedFeatures) {
    return "Seus registros mostram sinais mistos que merecem atenção";
  }
  if (bipolarContext?.consecutiveShortSleep && bipolarContext.consecutiveShortSleep >= 3) {
    return `${bipolarContext.consecutiveShortSleep} noites curtas seguidas — atenção ao seu padrão de sono`;
  }
  if (bipolarContext?.maniaSignsActive && bipolarContext.maniaSignsActive.length >= 2) {
    return "Seus registros recentes mostram sinais de ativação que merecem atenção";
  }

  if (urgency === "atencao") {
    return "Percebemos que você pode estar passando por um momento difícil";
  }

  return "Cuidando de você";
}

function getDescription(
  urgency: UrgencyLevel,
  phq9Item9: number | null | undefined,
  bipolarContext: Props["bipolarContext"],
): string {
  if (phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 1) {
    return "Suas respostas indicam pensamentos que merecem atenção. Na página Hoje há uma triagem rápida e confidencial que pode ajudar a entender qual apoio faz sentido agora.";
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
  const isAtencao = urgency === "atencao";

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="rounded-lg border border-amber-700 bg-amber-950/50 p-3 text-sm text-amber-200"
      >
        <p className="font-medium">
          Lembre-se: você não está sozinho.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <a
            href="tel:188"
            aria-label="Ligar para CVV 188"
            className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 min-h-[44px] min-w-[44px] text-xs font-medium hover:bg-white/20"
          >
            CVV 188
          </a>
          <a
            href="/sos"
            aria-label="Abrir página de SOS"
            className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 min-h-[44px] min-w-[44px] text-xs font-medium hover:bg-white/20"
          >
            SOS
          </a>
          {showForPhq9 && (
            <a
              href="/hoje"
              aria-label="Ir para triagem de segurança"
              className="inline-flex items-center rounded-full bg-amber-700/50 px-3 py-1 min-h-[44px] min-w-[44px] text-xs font-medium hover:bg-amber-700/70"
            >
              Triagem rápida
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="rounded-xl border border-amber-700 bg-amber-950/50 p-5"
    >
      <h3 className="mb-2 text-sm font-semibold text-amber-300">
        {getHeadline(urgency, bipolarContext)}
      </h3>

      <p className="mb-3 text-sm text-amber-200">
        {getDescription(urgency, phq9Item9, bipolarContext)}
      </p>

      <div className="space-y-2">
        {/* PHQ-9 item 9 positive: link to safety screening on /hoje */}
        {showForPhq9 && (
          <a
            href="/hoje"
            aria-label="Ir para triagem de segurança na página Hoje"
            className="inline-flex items-center rounded-lg bg-amber-700 px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium text-white hover:bg-amber-600"
          >
            Fazer triagem de segurança
          </a>
        )}

        {/* CVV 188 + SOS + Crisis plan */}
        <div className="flex flex-wrap gap-2">
          <a
            href="tel:188"
            aria-label="Ligar para CVV 188 — Escuta e apoio 24 horas"
            className={`inline-flex items-center rounded-lg px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium ${
              isAtencao && !showForPhq9
                ? "bg-amber-700 text-white hover:bg-amber-600"
                : "bg-white/10 text-foreground/80 hover:bg-white/20"
            }`}
          >
            CVV 188 — Escuta e apoio 24h
          </a>
          <a
            href="/sos"
            aria-label="Abrir página de SOS"
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium text-foreground/80 hover:bg-white/20"
          >
            Abrir SOS
          </a>
          <a
            href="/plano-de-crise"
            aria-label="Abrir meu plano de crise"
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 min-h-[44px] min-w-[44px] text-sm font-medium text-foreground/80 hover:bg-white/20"
          >
            Meu plano de crise
          </a>
        </div>

        {/* CAPS/UBS guidance for users without a professional */}
        <div className="mt-1 rounded-lg bg-amber-950/30 p-2 text-xs text-amber-300/80">
          <p className="font-medium mb-0.5">Não tem profissional de referência?</p>
          <p>
            O CAPS (Centro de Atenção Psicossocial) oferece atendimento gratuito pelo SUS,
            inclusive para transtorno bipolar. Procure o CAPS mais próximo ou peça
            encaminhamento na UBS do seu bairro.
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-muted">
        Este aplicativo não substitui avaliação profissional.
      </p>
    </div>
  );
}
