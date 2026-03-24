/**
 * SafetyInterstitial — ASQ + BSSA screening flow.
 *
 * Shown as interstitial when safety screening is required:
 * - PHQ-9 item 9 ≥ 1 (without completed screening)
 * - Today's warning signs include suicidal thoughts
 * - User presses "Preciso de ajuda agora"
 *
 * Flow: ASQ (4 yes/no) → if positive, Q5 → if positive, BSSA → disposition.
 * Based on NIMH ASQ Toolkit.
 */

"use client";

import { useState } from "react";
import type { AsqResult, BssaResult, ThoughtRecency, ThoughtFrequency, PastAttemptRecency } from "@/lib/risk-v2/types";

interface Props {
  source: "phq9_item9" | "warning_sign" | "manual_help_now";
  sourceAssessmentId?: string;
  onComplete: (result: { asq: AsqResult; bssa?: BssaResult; disposition: string; alertLayer: string }) => void;
  onDefer: () => void;
}

type Step = "intro" | "asq" | "asq_q5" | "bssa" | "result_clear" | "result_concern";

const ASQ_QUESTIONS = [
  "Nas últimas semanas, você desejou estar morto(a)?",
  "Nas últimas semanas, você sentiu que sua família ficaria melhor sem você?",
  "Na última semana, você teve pensamentos sobre se matar?",
  "Você já tentou se matar alguma vez?",
];

export function SafetyInterstitial({ source, sourceAssessmentId, onComplete, onDefer }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [asqAnswers, setAsqAnswers] = useState<boolean[]>([false, false, false, false]);
  const [asqQ5, setAsqQ5] = useState<boolean | null>(null);
  const [bssa, setBssa] = useState<Partial<BssaResult>>({});
  const [saving, setSaving] = useState(false);

  const asqIsPositive = asqAnswers.some(Boolean);

  async function submitScreening(asq: AsqResult, bssaResult?: BssaResult) {
    setSaving(true);
    try {
      const res = await fetch("/api/safety-screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          sourceAssessmentId,
          asq,
          bssa: bssaResult,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onComplete({ asq, bssa: bssaResult, disposition: data.disposition, alertLayer: data.alertLayer });
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  // ── Step: Intro ──────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div className="rounded-xl border border-orange-400 bg-orange-50 p-6 shadow-sm">
        <h3 className="text-base font-bold text-orange-900 mb-2">
          Triagem de segurança
        </h3>
        <p className="text-sm text-orange-800 mb-4">
          Você marcou um sinal que merece cuidado. São perguntas rápidas para entender qual apoio faz sentido agora.
          Suas respostas são confidenciais.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setStep("asq")}
            className="flex-1 rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium text-white hover:bg-orange-700"
          >
            Começar agora
          </button>
          <button
            onClick={onDefer}
            className="flex-1 rounded-lg border border-orange-300 px-4 py-3 text-sm font-medium text-orange-800 hover:bg-orange-100"
          >
            Lembrar em 15 min
          </button>
        </div>
        <p className="mt-3 text-[10px] text-muted">
          Baseado no ASQ (Ask Suicide-Screening Questions) do NIMH.
        </p>
      </div>
    );
  }

  // ── Step: ASQ Questions (1-4) ────────────────────────────────
  if (step === "asq") {
    return (
      <div className="rounded-xl border border-orange-400 bg-orange-50 p-6 shadow-sm">
        <h3 className="text-base font-bold text-orange-900 mb-4">
          Triagem rápida
        </h3>
        <div className="space-y-4">
          {ASQ_QUESTIONS.map((q, i) => (
            <div key={i} className="flex items-start gap-3">
              <p className="text-sm text-orange-900 flex-1">{q}</p>
              <div className="flex gap-1.5 shrink-0">
                <button
                  aria-label={`Sim — ${q}`}
                  onClick={() => {
                    const next = [...asqAnswers];
                    next[i] = true;
                    setAsqAnswers(next);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    asqAnswers[i] === true
                      ? "bg-red-600 text-white"
                      : "border border-orange-300 bg-white text-orange-800 hover:bg-orange-100"
                  }`}
                >
                  Sim
                </button>
                <button
                  aria-label={`Não — ${q}`}
                  onClick={() => {
                    const next = [...asqAnswers];
                    next[i] = false;
                    setAsqAnswers(next);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    asqAnswers[i] === false
                      ? "bg-emerald-600 text-white"
                      : "border border-orange-300 bg-white text-orange-800 hover:bg-orange-100"
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            if (asqIsPositive) {
              setStep("asq_q5");
            } else {
              const asq: AsqResult = { q1: asqAnswers[0], q2: asqAnswers[1], q3: asqAnswers[2], q4: asqAnswers[3] };
              setStep("result_clear");
              submitScreening(asq);
            }
          }}
          className="mt-4 w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium text-white hover:bg-orange-700"
        >
          Continuar
        </button>
      </div>
    );
  }

  // ── Step: ASQ Q5 (acuity) ────────────────────────────────────
  if (step === "asq_q5") {
    return (
      <div className="rounded-xl border border-red-400 bg-red-50 p-6 shadow-sm">
        <h3 className="text-base font-bold text-red-900 mb-2">
          Mais uma pergunta importante
        </h3>
        <p className="text-sm text-red-800 mb-4">
          Você está tendo pensamentos de se matar <strong>agora</strong>?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAsqQ5(true);
              const asq: AsqResult = {
                q1: asqAnswers[0], q2: asqAnswers[1], q3: asqAnswers[2], q4: asqAnswers[3],
                q5CurrentThoughtsNow: true,
              };
              // Acute positive — immediate disposition, skip BSSA
              submitScreening(asq);
              setStep("result_concern");
            }}
            className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
          >
            Sim
          </button>
          <button
            onClick={() => {
              setAsqQ5(false);
              setStep("bssa");
            }}
            className="flex-1 rounded-lg border border-red-300 px-4 py-3 text-sm font-medium text-red-800 hover:bg-red-100"
          >
            Não
          </button>
        </div>
      </div>
    );
  }

  // ── Step: BSSA (simplified) ──────────────────────────────────
  if (step === "bssa") {
    return (
      <BssaFlow
        saving={saving}
        onComplete={(bssaResult) => {
          const asq: AsqResult = {
            q1: asqAnswers[0], q2: asqAnswers[1], q3: asqAnswers[2], q4: asqAnswers[3],
            q5CurrentThoughtsNow: asqQ5 ?? false,
          };
          submitScreening(asq, bssaResult);
          // Determine which result screen to show
          if (bssaResult.canStaySafe === "no" || bssaResult.thoughtRecency === "now" ||
            (bssaResult.hasPlan && bssaResult.planIsDetailed && bssaResult.hasAccessToMeans) ||
            bssaResult.pastAttempt === "<3_months" || bssaResult.pastAttempt === "<7_days") {
            setStep("result_concern");
          } else {
            setStep("result_concern"); // ASQ was positive, so always show concern
          }
        }}
      />
    );
  }

  // ── Result: Clear ────────────────────────────────────────────
  if (step === "result_clear") {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 shadow-sm">
        <h3 className="text-base font-bold text-emerald-900 mb-2">
          Obrigado por responder
        </h3>
        <p className="text-sm text-emerald-800 mb-4">
          Suas respostas não indicam risco agudo neste momento. Mesmo assim, se precisar de apoio,
          o CVV (188) está disponível 24 horas.
        </p>
        <p className="text-[10px] text-muted">
          Este aplicativo não substitui avaliação profissional.
        </p>
      </div>
    );
  }

  // ── Result: Concern ──────────────────────────────────────────
  return (
    <div className="rounded-xl border border-red-400 bg-red-50 p-6 shadow-sm" role="alert">
      <h3 className="text-base font-bold text-red-900 mb-2">
        Queremos garantir que você está seguro
      </h3>
      <p className="text-sm text-red-800 mb-4">
        Suas respostas indicam que você pode precisar de apoio agora. Existem pessoas prontas para ajudar
        — 24 horas, todos os dias.
      </p>
      <div className="space-y-2">
        <a
          href="tel:192"
          className="block w-full rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white text-center hover:bg-red-600"
        >
          Ligar SAMU 192
        </a>
        <a
          href="tel:188"
          className="block w-full rounded-lg bg-white/60 border border-red-300 px-4 py-3 text-sm font-medium text-red-800 text-center hover:bg-red-100"
        >
          Ligar CVV 188
        </a>
      </div>
      <p className="mt-3 text-[10px] text-muted">
        Este aplicativo não substitui avaliação profissional. Em emergência, ligue 192.
      </p>
    </div>
  );
}

// ── BSSA Sub-flow ────────────────────────────────────────────────

function BssaFlow({
  saving,
  onComplete,
}: {
  saving: boolean;
  onComplete: (result: BssaResult) => void;
}) {
  const [currentKey, setCurrentKey] = useState<keyof BssaResult>("thoughtRecency");
  const [answers, setAnswers] = useState<Partial<BssaResult>>({
    thoughtRecency: undefined,
    thoughtFrequency: undefined,
    hasPlan: undefined,
    planIsDetailed: false,
    hasAccessToMeans: false,
    pastAttempt: undefined,
    preparatoryBehavior: undefined,
    canStaySafe: undefined,
  });

  const allQuestions: {
    key: keyof BssaResult;
    label: string;
    options: { value: string; label: string }[];
    /** Only show this question if condition returns true */
    showIf?: () => boolean;
  }[] = [
    {
      key: "thoughtRecency",
      label: "Quando foi a última vez que você teve esses pensamentos?",
      options: [
        { value: "now", label: "Agora" },
        { value: "today", label: "Hoje" },
        { value: "2_7_days", label: "Nos últimos 7 dias" },
        { value: "8_30_days", label: "Nos últimos 30 dias" },
        { value: ">30_days", label: "Há mais de 30 dias" },
      ],
    },
    {
      key: "thoughtFrequency",
      label: "Com que frequência você tem esses pensamentos?",
      options: [
        { value: "once", label: "Uma vez" },
        { value: "occasional", label: "De vez em quando" },
        { value: "daily", label: "Todo dia" },
        { value: "many_times_day", label: "Várias vezes ao dia" },
      ],
    },
    {
      key: "hasPlan",
      label: "Você tem um plano de como faria isso?",
      options: [
        { value: "false", label: "Não" },
        { value: "true", label: "Sim" },
      ],
    },
    {
      key: "planIsDetailed",
      label: "O plano é detalhado — você sabe quando, onde ou como faria?",
      options: [
        { value: "false", label: "Não, é vago" },
        { value: "true", label: "Sim, é detalhado" },
      ],
      showIf: () => answers.hasPlan === true,
    },
    {
      key: "hasAccessToMeans",
      label: "Você tem acesso aos meios para fazer o que planejou?",
      options: [
        { value: "false", label: "Não" },
        { value: "true", label: "Sim" },
      ],
      showIf: () => answers.hasPlan === true,
    },
    {
      key: "pastAttempt",
      label: "Você já tentou se machucar ou tirar a própria vida antes?",
      options: [
        { value: "never", label: "Nunca" },
        { value: ">1_year", label: "Há mais de 1 ano" },
        { value: "3_12_months", label: "Nos últimos 12 meses" },
        { value: "<3_months", label: "Nos últimos 3 meses" },
        { value: "<7_days", label: "Na última semana" },
      ],
    },
    {
      key: "canStaySafe",
      label: "Você se sente capaz de se manter seguro(a) agora?",
      options: [
        { value: "yes", label: "Sim" },
        { value: "unsure", label: "Não tenho certeza" },
        { value: "no", label: "Não" },
      ],
    },
  ];

  // Compute visible questions with current answers (for showIf evaluation)
  function getVisibleQuestions(ans: Partial<BssaResult>) {
    return allQuestions.filter((q) => {
      if (!q.showIf) return true;
      // Evaluate showIf with the given answers snapshot
      if (q.key === "planIsDetailed" || q.key === "hasAccessToMeans") {
        return ans.hasPlan === true;
      }
      return true;
    });
  }

  const visibleQuestions = getVisibleQuestions(answers);
  const currentQ = visibleQuestions.find((q) => q.key === currentKey);
  const currentVisibleIndex = visibleQuestions.findIndex((q) => q.key === currentKey);
  if (!currentQ) return null;

  function handleAnswer(value: string) {
    const key = currentQ!.key;
    let parsed: string | boolean = value;
    if (value === "true") parsed = true;
    if (value === "false") parsed = false;

    const next = { ...answers, [key]: parsed };

    // If hasPlan is false, reset dependent fields
    if (key === "hasPlan" && parsed === false) {
      next.planIsDetailed = false;
      next.hasAccessToMeans = false;
    }

    setAnswers(next);

    // Find next visible question using updated answers
    const updatedVisible = getVisibleQuestions(next);
    const idx = updatedVisible.findIndex((q) => q.key === key);
    if (idx < updatedVisible.length - 1) {
      setCurrentKey(updatedVisible[idx + 1].key);
    } else {
      // Complete
      const result: BssaResult = {
        thoughtRecency: (next.thoughtRecency || ">30_days") as ThoughtRecency,
        thoughtFrequency: (next.thoughtFrequency || "once") as ThoughtFrequency,
        hasPlan: next.hasPlan === true,
        planIsDetailed: next.planIsDetailed === true,
        hasAccessToMeans: next.hasAccessToMeans === true,
        pastAttempt: (next.pastAttempt || "never") as PastAttemptRecency,
        preparatoryBehavior: (next.preparatoryBehavior || "never") as PastAttemptRecency,
        canStaySafe: (next.canStaySafe || "yes") as "yes" | "unsure" | "no",
      };
      onComplete(result);
    }
  }

  return (
    <div className="rounded-xl border border-orange-400 bg-orange-50 p-6 shadow-sm">
      <p className="text-xs text-orange-600 mb-1">
        Pergunta {currentVisibleIndex + 1} de {visibleQuestions.length}
      </p>
      <h3 className="text-sm font-semibold text-orange-900 mb-4">
        {currentQ.label}
      </h3>
      <div className="space-y-2">
        {currentQ.options.map((opt) => (
          <button
            key={opt.value}
            aria-label={`${opt.label} — ${currentQ.label}`}
            onClick={() => handleAnswer(opt.value)}
            disabled={saving}
            className="block w-full rounded-lg border border-orange-300 bg-white px-4 py-3 text-sm text-left text-orange-900 hover:bg-orange-100 transition-colors disabled:opacity-50"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-muted">
        Suas respostas são confidenciais. Baseado no protocolo BSSA do NIMH.
      </p>
    </div>
  );
}
