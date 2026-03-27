"use client";

import { useNarrative } from "./useNarrative";
import { NarrativeDisplay, APP_DISCLAIMER } from "./NarrativeDisplay";
import { NarrativeFeedback } from "./NarrativeFeedback";
import { NarrativeProgress } from "./NarrativeProgress";
import { LoadingState, ErrorState } from "@/components/ui/StatusStates";

export function NarrativeSection() {
  const {
    data,
    loading,
    loadingCache,
    error,
    retryCooldown,
    feedbackSent,
    consentChecked,
    setConsentChecked,
    consentPersisted,
    generate,
    submitFeedback,
  } = useNarrative();

  const narrative = data?.narrative;

  // Still loading cache
  if (loadingCache) {
    return <LoadingState message="Carregando resumo..." />;
  }

  // Not generated yet — show CTA with explicit consent (or skip if already persisted)
  if (!narrative && !loading && !error) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center">
        <p className="mb-1 text-sm font-semibold text-foreground">Seu resumo personalizado</p>
        <p className="mb-3 text-xs text-muted">Uma visão geral do que mudou nos seus registros dos últimos 30 dias.</p>

        {/* Guardrail failure warning */}
        {data?.latestAttemptFailed && (
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-left dark:border-amber-800 dark:bg-amber-950">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Sua narrativa mais recente não pôde ser exibida por não atender aos critérios de segurança.
              Você pode tentar gerar uma nova abaixo.
            </p>
          </div>
        )}

        {/* If consent already persisted, skip the full disclosure — show compact notice */}
        {consentPersisted ? (
          <>
            <p className="mb-3 text-xs text-muted text-left">
              Seu consentimento para uso de IA está ativo. Seus dados serão enviados à OpenAI
              exclusivamente para gerar este resumo.
            </p>
            <button
              onClick={generate}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark min-h-[44px]"
            >
              Gerar resumo com IA
            </button>
            <p className="mt-2 text-[11px] text-muted">
              <a href="/consentimentos" className="underline hover:text-foreground">
                Gerenciar consentimento
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted text-left">
              A IA analisa seus dados de sono, humor, ritmos, avaliações, eventos de vida e registros financeiros
              dos últimos 30 dias para gerar uma interpretação personalizada por área. Ao clicar, seus dados são
              enviados à OpenAI (processador terceiro) exclusivamente para gerar este resumo. Seus dados não são
              usados para treinar modelos e são retidos por até 30 dias para monitoramento de abuso, conforme a{" "}
              <a href="https://openai.com/policies/usage-policies" target="_blank" rel="noopener noreferrer" className="underline">
                política da OpenAI
              </a>.
            </p>

            {/* Explicit consent checkbox (LGPD: manifestação inequívoca para dados sensíveis) */}
            <label className="mb-4 flex items-start gap-2 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
              />
              <span className="text-xs text-foreground/80">
                Li e entendo que meus dados de saúde serão enviados à OpenAI para gerar este resumo.
                Posso revogar este consentimento a qualquer momento nas configurações da conta.
              </span>
            </label>

            <button
              onClick={generate}
              disabled={!consentChecked}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              Gerar resumo com IA
            </button>
          </>
        )}
        <p className="mt-2 text-[11px] text-muted italic">Powered by GPT — {APP_DISCLAIMER}</p>
      </div>
    );
  }

  // Loading (no previous narrative)
  if (loading && !narrative) {
    return <NarrativeProgress active />;
  }

  // Error (no previous narrative)
  if (error && !narrative) {
    return (
      <ErrorState
        message={error}
        onRetry={!retryCooldown ? generate : undefined}
      />
    );
  }

  if (!narrative || !data) return null;

  return (
    <>
      <NarrativeDisplay
        narrative={narrative}
        data={data}
        onRefresh={generate}
        refreshLoading={loading}
        refreshCooldown={retryCooldown}
      />

      {/* Footer: metadata, feedback, regenerate */}
      <div className="border-t border-border/30 pt-3 mt-3 space-y-2">
        <p className="text-[11px] text-muted italic">
          {narrative.source === "llm" ? "Gerado por IA"
            : narrative.source === "fallback" ? "Dados enviados à IA (resumo indisponível)"
            : "Resumo automático local"}
          {narrative.generatedAt && ` em ${new Date(narrative.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          . {APP_DISCLAIMER}
        </p>

        {narrative.overview.dataQualityNote &&
         narrative.overview.dataQualityNote !== "Análise baseada nos registros disponíveis." && (
          <p className="text-[11px] text-muted italic">{narrative.overview.dataQualityNote}</p>
        )}

        <NarrativeFeedback
          narrativeId={data.narrativeId}
          feedbackSent={feedbackSent}
          onFeedback={submitFeedback}
        />

        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <a href="/consentimentos" className="text-xs text-muted underline hover:text-foreground">
          Gerenciar consentimento
        </a>
      </div>
    </>
  );
}
