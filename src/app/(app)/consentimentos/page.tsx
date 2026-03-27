"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";

interface ConsentRecord {
  scope: string;
  version: number;
  grantedAt: string;
}

const CONSENT_SCOPES = [
  {
    scope: "health_data",
    label: "Dados de saúde",
    description: "Armazenamento de registros de humor, sono, ritmos e avaliações.",
    essential: true,
  },
  {
    scope: "terms_of_use",
    label: "Termos de uso",
    description: "Aceite dos termos de uso e política de privacidade.",
    essential: true,
  },
  {
    scope: "ai_narrative",
    label: "Resumo com IA",
    description: "Envio de dados anonimizados para a OpenAI gerar resumos nos Insights. Dados não são usados para treinar modelos.",
    essential: false,
  },
  {
    scope: "push_notifications",
    label: "Notificações push",
    description: "Lembretes de check-in, sono e atividades no navegador ou celular.",
    essential: false,
  },
  {
    scope: "email_notifications",
    label: "Notificações por e-mail",
    description: "Resumos semanais e lembretes por e-mail.",
    essential: false,
  },
  {
    scope: "whatsapp",
    label: "WhatsApp",
    description:
      "Lembretes via WhatsApp Business (mensagens genéricas, sem conteúdo de saúde). " +
      "Ao ativar, seus dados de contato (número de telefone) serão processados pela Meta Platforms, Inc. (EUA/EU) " +
      "como operadora, com retenção de até 30 dias nos servidores da Meta. " +
      "Constitui transferência internacional de dados (LGPD art. 33). " +
      "Você pode revogar este consentimento a qualquer momento.",
    essential: false,
  },
  {
    scope: "professional_sharing",
    label: "Compartilhamento profissional",
    description: "Permitir que profissionais de saúde acessem seus dados via link de Acesso Profissional.",
    essential: false,
  },
  {
    scope: "assessments",
    label: "Avaliações clínicas",
    description:
      "Registro e armazenamento de autoavaliações estruturadas (PHQ-9, ASRM, FAST). " +
      "Produz dados sensíveis de saúde mental usados para acompanhamento longitudinal.",
    essential: false,
  },
  {
    scope: "crisis_plan",
    label: "Plano de crise",
    description:
      "Manutenção do plano de crise com contatos de confiança, profissional e estratégias. " +
      "Inclui dados de terceiros (contatos) inseridos por você.",
    essential: false,
  },
  {
    scope: "sos_chatbot",
    label: "SOS — Apoio por IA",
    description:
      "Uso do chatbot de apoio emocional temporário (processado por Anthropic Claude). Não substitui atendimento de emergência. " +
      "Em situações de risco, o recurso funciona independentemente deste consentimento (LGPD art. 11, II, e).",
    essential: false,
  },
  {
    scope: "clinical_export",
    label: "Exportação clínica",
    description:
      "Geração de relatórios estruturados para compartilhar com seu profissional de saúde. " +
      "Dados minimizados (sem diário em texto livre).",
    essential: false,
  },
] as const;

export default function ConsentimentosPage() {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/consentimentos");
        if (res.ok) {
          const data = await res.json();
          setConsents(data.consents);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const toggleConsent = useCallback(async (scope: string, currentlyActive: boolean) => {
    setUpdating(scope);
    try {
      const res = await fetch("/api/consentimentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          action: currentlyActive ? "revoke" : "grant",
        }),
      });
      if (res.ok) {
        if (currentlyActive) {
          setConsents((prev) => prev.filter((c) => c.scope !== scope));
        } else {
          setConsents((prev) => [
            ...prev,
            { scope, version: 1, grantedAt: new Date().toISOString() },
          ]);
        }
      }
    } catch { /* ignore */ }
    setUpdating(null);
  }, []);

  const activeScopes = new Set(consents.map((c) => c.scope));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Privacidade e Consentimentos</h1>
      <p className="mb-6 text-sm text-muted">
        Gerencie quais dados você autoriza o Suporte Bipolar a processar. Consentimentos essenciais
        não podem ser revogados aqui — para isso, use a opção de exclusão de conta.
      </p>

      <div className="space-y-3">
        {CONSENT_SCOPES.map((item) => {
          const isActive = activeScopes.has(item.scope);
          const isUpdating = updating === item.scope;

          return (
            <Card key={item.scope}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.essential && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-1">{item.description}</p>
                  {isActive && consents.find((c) => c.scope === item.scope) && (
                    <p className="text-[11px] text-muted mt-1">
                      Concedido em{" "}
                      {new Date(consents.find((c) => c.scope === item.scope)!.grantedAt).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <div className="shrink-0 pt-0.5">
                  {item.essential ? (
                    <div
                      className="h-6 w-11 rounded-full bg-primary/60 cursor-not-allowed relative"
                      title="Consentimento essencial — não pode ser revogado"
                    >
                      <div className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleConsent(item.scope, isActive)}
                      disabled={isUpdating}
                      className={`h-6 w-11 rounded-full relative transition-colors ${
                        isActive ? "bg-primary" : "bg-border"
                      } ${isUpdating ? "opacity-50" : ""}`}
                      role="switch"
                      aria-checked={isActive}
                      aria-label={`${isActive ? "Revogar" : "Conceder"} ${item.label}`}
                    >
                      <div
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          isActive ? "right-0.5" : "left-0.5"
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-border/50 bg-surface-alt p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Seus direitos (LGPD)</h2>
        <ul className="space-y-1 text-xs text-muted">
          <li>Você pode revogar qualquer consentimento opcional a qualquer momento.</li>
          <li>Para excluir todos os seus dados, use a opção em Conta → Excluir Conta.</li>
          <li>Para solicitar uma cópia dos seus dados, use Relatório → Exportar.</li>
          <li>Dúvidas: contato@suportebipolar.com</li>
        </ul>
      </div>
    </div>
  );
}
