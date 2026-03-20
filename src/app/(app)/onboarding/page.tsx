"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";

type Step = "welcome" | "profile" | "goal" | "anchor" | "week" | "ready";
type Profile = "recent" | "veteran" | "caregiver";

const PROFILES = [
  {
    key: "recent" as Profile,
    label: "Recebi o diagnóstico recentemente",
    desc: "Estou entendendo o que é bipolaridade e como me cuidar",
    icon: "🌱",
  },
  {
    key: "veteran" as Profile,
    label: "Convivo há anos com bipolar",
    desc: "Quero otimizar meu acompanhamento e ter mais dados",
    icon: "📊",
  },
  {
    key: "caregiver" as Profile,
    label: "Sou familiar ou cuidador",
    desc: "Quero apoiar alguém com transtorno bipolar",
    icon: "🤝",
  },
] as const;

const GOALS_BY_PROFILE: Record<Profile, { key: string; label: string; desc: string; icon: string }[]> = {
  recent: [
    { key: "sleep", label: "Dormir melhor", desc: "O sono é o primeiro sinal — acompanhar padrões ajuda a prevenir episódios", icon: "🌙" },
    { key: "detect", label: "Perceber sinais cedo", desc: "Aprender a identificar mudanças antes que piorem", icon: "🔔" },
    { key: "learn", label: "Entender o transtorno", desc: "Conteúdo validado por protocolos clínicos (IPSRT, PROMAN/USP)", icon: "📚" },
  ],
  veteran: [
    { key: "consult", label: "Levar dados à consulta", desc: "Relatórios prontos com ASRM, PHQ-9, FAST e histórico", icon: "📋" },
    { key: "routine", label: "Estabilizar rotina", desc: "Manter horários regulares no dia a dia (ritmo social)", icon: "⏰" },
    { key: "detect", label: "Perceber padrões", desc: "Correlações sono-humor, ciclagem rápida, sazonalidade", icon: "📊" },
  ],
  caregiver: [
    { key: "detect", label: "Identificar sinais de alerta", desc: "Saber quando algo está mudando no comportamento", icon: "🔔" },
    { key: "consult", label: "Acompanhar com o profissional", desc: "Ver os mesmos dados que o profissional de saúde vê", icon: "📋" },
    { key: "sleep", label: "Monitorar o sono", desc: "Alterações no sono costumam ser o primeiro sinal", icon: "🌙" },
  ],
};

const ANCHOR_BY_GOAL: Record<string, { icon: string; title: string; desc: string }> = {
  sleep: { icon: "🌙", title: "Registrar seu sono", desc: "Todo dia ao acordar, registre a que horas dormiu e acordou. Leva 15 segundos. O app vai mostrar seus padrões." },
  detect: { icon: "📊", title: "Check-in diário", desc: "Todo dia, marque como está seu humor e energia (1 a 5). Com o tempo, o app identifica padrões e sinais de alerta." },
  consult: { icon: "📋", title: "Avaliação semanal", desc: "Uma vez por semana, responda 3 questionários rápidos sobre mania, depressão e funcionamento. Gera relatórios prontos para levar à consulta." },
  routine: { icon: "⏰", title: "Horários-âncora", desc: "Registre 5 momentos-chave do dia: acordar, primeiro contato social, atividade principal, jantar e dormir." },
  learn: { icon: "📚", title: "Leitura semanal", desc: "Toda semana, leia um conteúdo curto sobre bipolaridade. O conhecimento te dá mais controle sobre o tratamento." },
};

const FIRST_WEEK: Record<Profile, { day: number; task: string; link: string; icon: string }[]> = {
  recent: [
    { day: 1, task: "Primeiro check-in de humor", link: "/checkin", icon: "📊" },
    { day: 2, task: "Registrar o sono de ontem", link: "/sono", icon: "🌙" },
    { day: 3, task: "Explorar a página de Insights", link: "/insights", icon: "💡" },
    { day: 4, task: "Preencher o Plano de Crise", link: "/plano-de-crise", icon: "🆘" },
    { day: 5, task: "Conhecer os exercícios de respiração", link: "/exercicios", icon: "🫁" },
    { day: 6, task: "Fazer a avaliação semanal", link: "/checkin?tab=semanal", icon: "📋" },
    { day: 7, task: "Ver seus primeiros padrões", link: "/insights", icon: "🎯" },
  ],
  veteran: [
    { day: 1, task: "Check-in + registro de sono", link: "/checkin", icon: "📊" },
    { day: 2, task: "Conectar wearable (Apple Health ou Android)", link: "/integracoes", icon: "⌚" },
    { day: 3, task: "Criar link de Acesso Profissional", link: "/conta", icon: "🔗" },
    { day: 4, task: "Preencher avaliação semanal (ASRM + PHQ-9)", link: "/checkin?tab=semanal", icon: "📋" },
    { day: 5, task: "Configurar horários-âncora", link: "/rotina", icon: "⏰" },
    { day: 6, task: "Importar dados financeiros (opcional)", link: "/financeiro", icon: "💰" },
    { day: 7, task: "Gerar resumo com IA nos Insights", link: "/insights", icon: "🤖" },
  ],
  caregiver: [
    { day: 1, task: "Fazer o check-in como cuidador", link: "/checkin", icon: "📊" },
    { day: 2, task: "Conhecer o SOS e Plano de Crise", link: "/plano-de-crise", icon: "🆘" },
    { day: 3, task: "Preencher perfil socioeconômico", link: "/conta", icon: "📝" },
    { day: 4, task: "Entender os Insights e sinais de alerta", link: "/insights", icon: "💡" },
    { day: 5, task: "Explorar os conteúdos educativos", link: "/conteudos", icon: "📚" },
    { day: 6, task: "Pedir à pessoa para criar Acesso Profissional", link: "/conta", icon: "🔗" },
    { day: 7, task: "Revisar o resumo da semana", link: "/insights", icon: "🎯" },
  ],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const steps: Step[] = ["welcome", "profile", "goal", "anchor", "week", "ready"];
  const currentIndex = steps.indexOf(step);

  async function completeOnboarding() {
    setFinishing(true);
    try {
      await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, profile }),
      });
    } catch {
      // Continue anyway
    }
    router.push("/hoje");
    router.refresh();
  }

  const goals = profile ? GOALS_BY_PROFILE[profile] : [];
  const anchor = goal ? ANCHOR_BY_GOAL[goal] : ANCHOR_BY_GOAL.detect;
  const weekTasks = profile ? FIRST_WEEK[profile] : FIRST_WEEK.recent;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-8">
      {/* Progress dots */}
      <div className="mb-8 flex gap-2">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-2 rounded-full transition-all ${
              s === step ? "w-8 bg-primary" : i < currentIndex ? "w-2 bg-primary/60" : "w-2 bg-border"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Welcome */}
      {step === "welcome" && (
        <div className="w-full space-y-6 text-center">
          <div className="text-5xl">🧠</div>
          <h1 className="text-2xl font-bold">Bem-vindo ao Suporte Bipolar</h1>
          <p className="text-sm text-muted leading-relaxed">
            Seu painel de estabilidade pessoal. Vamos configurar em menos de 2 minutos
            para que o app funcione da melhor forma para você.
          </p>
          <button
            onClick={() => setStep("profile")}
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

      {/* Step 2: Profile (3 tracks) */}
      {step === "profile" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Como você se identifica?</h2>
          <p className="text-sm text-muted text-center">
            Isso personaliza o app para o seu momento.
          </p>
          <div className="space-y-2">
            {PROFILES.map((p) => (
              <button
                key={p.key}
                onClick={() => setProfile(p.key)}
                className={`w-full text-left rounded-lg border p-4 transition-colors ${
                  profile === p.key
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{p.label}</h3>
                    <p className="text-xs text-muted">{p.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep("goal")}
            disabled={!profile}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white disabled:opacity-50"
          >
            Continuar
          </button>
          <button onClick={completeOnboarding} className="w-full text-xs text-muted underline">
            Pular
          </button>
        </div>
      )}

      {/* Step 3: Goal (context-dependent) */}
      {step === "goal" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Qual seu principal objetivo?</h2>
          <p className="text-sm text-muted text-center">
            {profile === "caregiver"
              ? "O que mais te ajudaria como cuidador?"
              : "Isso nos ajuda a recomendar por onde começar."}
          </p>
          <div className="space-y-2">
            {goals.map((g) => (
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
          <button onClick={completeOnboarding} className="w-full text-xs text-muted underline">
            Pular
          </button>
        </div>
      )}

      {/* Step 4: Anchor habit */}
      {step === "anchor" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Sua âncora diária</h2>
          <p className="text-sm text-muted text-center leading-relaxed">
            {profile === "caregiver"
              ? "Manter um registro regular ajuda a perceber mudanças cedo."
              : "No tratamento do transtorno bipolar, manter um hábito regular é mais importante do que tentar fazer tudo de uma vez."}
          </p>

          <Card>
            <div className="space-y-3 text-center">
              <div className="text-3xl">{anchor.icon}</div>
              <h3 className="text-sm font-semibold">{anchor.title}</h3>
              <p className="text-xs text-muted">{anchor.desc}</p>
            </div>
          </Card>

          <div className="rounded-lg bg-surface-alt p-3">
            <p className="text-[11px] text-muted text-center">
              Comece só com isso. Quando virar hábito, explore as outras ferramentas no seu ritmo.
            </p>
          </div>

          <button
            onClick={() => setStep("week")}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white"
          >
            Entendi, vamos lá
          </button>
        </div>
      )}

      {/* Step 5: First week plan */}
      {step === "week" && (
        <div className="w-full space-y-4">
          <h2 className="text-lg font-bold text-center">Sua primeira semana</h2>
          <p className="text-sm text-muted text-center">
            Um passo por dia — sem pressa, sem pressão.
          </p>

          <div className="space-y-1.5">
            {weekTasks.map((t) => (
              <div
                key={t.day}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface p-3"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {t.day}
                </span>
                <span className="text-sm text-foreground">{t.icon} {t.task}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted text-center italic">
            Estas sugestões vão aparecer nos seus lembretes diários.
          </p>

          <button
            onClick={() => setStep("ready")}
            className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white"
          >
            Continuar
          </button>
        </div>
      )}

      {/* Step 6: Ready */}
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
