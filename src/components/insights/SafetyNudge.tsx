"use client";

/**
 * SafetyNudge — shown when PHQ-9 item 9 >= 1 or risk score is high.
 * Provides immediate access to crisis resources without being alarmist.
 * Based on Columbia Protocol guidelines for digital tools.
 */

interface Props {
  /** PHQ-9 item 9 score (0-3) — thoughts of self-harm */
  phq9Item9?: number | null;
  /** Risk level from computeInsights */
  riskLevel?: "ok" | "atencao" | "atencao_alta" | null;
  /** Whether to show compact version (inline) vs full */
  compact?: boolean;
}

export function SafetyNudge({ phq9Item9, riskLevel, compact }: Props) {
  const showForPhq9 = phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 1;
  const showForRisk = riskLevel === "atencao_alta";

  if (!showForPhq9 && !showForRisk) return null;

  const isUrgent = (phq9Item9 !== null && phq9Item9 !== undefined && phq9Item9 >= 2) || showForRisk;

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
        {isUrgent
          ? "Percebemos que você pode estar passando por um momento difícil"
          : "Cuidando de você"}
      </h3>

      <p className={`mb-3 text-sm ${isUrgent ? "text-red-200" : "text-amber-200"}`}>
        {isUrgent
          ? "Se você está tendo pensamentos de se machucar, saiba que existem pessoas prontas para ajudar — 24 horas, todos os dias."
          : "Seus registros recentes mostram sinais que merecem atenção. Conversar com alguém pode ajudar."}
      </p>

      <div className="flex flex-wrap gap-2">
        <a
          href="tel:188"
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${
            isUrgent
              ? "bg-red-700 text-white hover:bg-red-600"
              : "bg-amber-700 text-white hover:bg-amber-600"
          }`}
        >
          Ligar CVV (188)
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

      <p className="mt-3 text-[10px] text-muted">
        Este aplicativo não substitui avaliação profissional. Em emergência, ligue 192 (SAMU).
      </p>
    </div>
  );
}
