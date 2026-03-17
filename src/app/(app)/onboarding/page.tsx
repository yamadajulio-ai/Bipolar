"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";

type Step = "welcome" | "goal" | "anchor" | "ready";

const GOALS = [
  { key: "sleep", label: "Dormir melhor", desc: "Acompanhar padrões de sono e regularidade", icon: "🌙" },
  { key: "detect", label: "Perceber sinais cedo", desc: "Identificar mudanças de humor antes que piorem", icon: "🔔" },
  { key: "consult", label: "Levar dados à consulta", desc: "Compartilhar relatórios com seu profissional", icon: "📋" },
  { key: "routine", label: "Estabilizar rotina", desc: "Manter horários regulares no dia a dia", icon: "⏰" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [goal, setGoal] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  async function completeOnboarding() {
    setFinishing(true);
    try {
      await fetch("/api/auth/complete-onboarding", { method: "POST" });
    } catch {
      // Continue anyway
    }
    router.push("/hoje");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center">
      {/* Progress dots */}
      <div className="mb-8 flex gap-2">
        {(["welcome", "goal", "anchor", "ready"] as Step[]).map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all ${
              s === step ? "w-8 bg-primary" : i < ["welcome", "goal", "anchor", "ready"].indexOf(step) ? "w-2 bg-primary/60" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {step === "welcome" && (
        <div className="w-full space-y-6 text-center">
          <div className="text-5xl">🧠</div>
          <h1 className="text-2xl font-bold">Bem-vindo ao Suporte Bipolar</h1>
          <p className="text-sm text-muted leading-relaxed">
            Seu painel de estabilidade pessoal. Vamos configurar em menos de 1 minuto
            para que o app funcione da melhor forma para você.
          </p>
          <button
            onClick={() => setStep("goal")}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white"
          >
            Vamos começar
          </button>
          <button
            onClick={completeOnboarding}
            className="text-xs text-muted underline"
          >
            Pular e explorar por conta própria
          </button>
        </div>
      )}

      {step === "goal" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Qual seu principal objetivo?</h2>
          <p className="text-sm text-muted text-center">
            Isso nos ajuda a personalizar sua experiência.
          </p>
          <div className="space-y-2">
            {GOALS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGoal(g.key)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  goal === g.key
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{g.label}</h3>
                    <p className="text-xs text-muted">{g.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("anchor")}
            disabled={!goal}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            Continuar
          </button>
          <button
            onClick={completeOnboarding}
            className="w-full text-xs text-muted underline"
          >
            Pular
          </button>
        </div>
      )}

      {step === "anchor" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Sua âncora diária</h2>
          <p className="text-sm text-muted text-center leading-relaxed">
            No tratamento do transtorno bipolar, manter <strong>um hábito regular</strong> é
            mais importante do que tentar fazer tudo de uma vez.
          </p>

          <Card>
            <div className="space-y-3">
              {goal === "sleep" && (
                <>
                  <div className="text-3xl text-center">🌙</div>
                  <h3 className="text-sm font-semibold text-center">Registrar seu sono</h3>
                  <p className="text-xs text-muted text-center">
                    Todo dia ao acordar, registre a que horas dormiu e acordou.
                    Leva 15 segundos. O app vai mostrar seus padrões.
                  </p>
                </>
              )}
              {goal === "detect" && (
                <>
                  <div className="text-3xl text-center">📊</div>
                  <h3 className="text-sm font-semibold text-center">Check-in diário</h3>
                  <p className="text-xs text-muted text-center">
                    Todo dia, marque como está seu humor e energia (1 a 5).
                    Com o tempo, o app identifica padrões e sinais de alerta.
                  </p>
                </>
              )}
              {goal === "consult" && (
                <>
                  <div className="text-3xl text-center">📋</div>
                  <h3 className="text-sm font-semibold text-center">Avaliação semanal</h3>
                  <p className="text-xs text-muted text-center">
                    Uma vez por semana, responda 3 questionários rápidos sobre mania, depressão e funcionamento.
                    Gera relatórios prontos para levar à consulta.
                  </p>
                </>
              )}
              {goal === "routine" && (
                <>
                  <div className="text-3xl text-center">⏰</div>
                  <h3 className="text-sm font-semibold text-center">Horários-âncora</h3>
                  <p className="text-xs text-muted text-center">
                    Registre 5 momentos-chave do dia: acordar, primeiro contato social,
                    atividade principal, jantar e dormir. O app mede sua regularidade.
                  </p>
                </>
              )}
              {!goal && (
                <>
                  <div className="text-3xl text-center">✨</div>
                  <h3 className="text-sm font-semibold text-center">Check-in diário</h3>
                  <p className="text-xs text-muted text-center">
                    Marque como está seu humor e energia todo dia. Rápido e simples.
                  </p>
                </>
              )}
            </div>
          </Card>

          <div className="rounded-lg bg-surface-alt p-3">
            <p className="text-[11px] text-muted text-center">
              💡 <strong>Dica:</strong> Comece só com isso. Quando virar hábito, explore
              as outras ferramentas no seu ritmo.
            </p>
          </div>

          <button
            onClick={() => setStep("ready")}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white"
          >
            Entendi, vamos lá
          </button>
        </div>
      )}

      {step === "ready" && (
        <div className="w-full space-y-6 text-center">
          <div className="text-5xl">🎯</div>
          <h2 className="text-xl font-bold">Tudo pronto!</h2>
          <div className="space-y-2 text-sm text-muted">
            <p>Lembre-se:</p>
            <ul className="space-y-1 text-left">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>O <strong>SOS</strong> (botão vermelho) está sempre acessível — até sem login</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Este app <strong>não substitui</strong> acompanhamento profissional</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>Seus dados são <strong>privados</strong> e protegidos pela LGPD</span>
              </li>
            </ul>
          </div>

          <button
            onClick={completeOnboarding}
            disabled={finishing}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            {finishing ? "Preparando..." : "Começar a usar"}
          </button>
        </div>
      )}
    </div>
  );
}
