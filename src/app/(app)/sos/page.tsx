"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { QuickBreathing } from "@/components/sos/QuickBreathing";

type View = "menu" | "emergency" | "breathing" | "grounding";

interface TrustedContact {
  name: string;
  phone: string;
}

function logSOS(action: string) {
  fetch("/api/sos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  }).catch(() => {});
}

export default function SOSPage() {
  const [view, setView] = useState<View>("menu");
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [professionalPhone, setProfessionalPhone] = useState<string | null>(
    null,
  );
  const [groundingStep, setGroundingStep] = useState(0);

  useEffect(() => {
    logSOS("opened");
    fetch("/api/plano-de-crise")
      .then((res) => (res.ok ? res.json() : null))
      .then((plan) => {
        if (!plan) return;
        if (plan.trustedContacts) {
          try {
            const parsed = JSON.parse(plan.trustedContacts);
            if (Array.isArray(parsed)) setContacts(parsed);
          } catch {}
        }
        if (plan.professionalPhone) {
          setProfessionalPhone(plan.professionalPhone);
        }
      })
      .catch(() => {});
  }, []);

  const goTo = useCallback((v: View) => {
    setView(v);
    if (v === "breathing") logSOS("breathing");
    if (v === "grounding") logSOS("grounding");
    if (v === "emergency") {
      // logged individually when calling
    }
  }, []);

  if (view === "breathing") {
    return (
      <div className="mx-auto max-w-lg">
        <QuickBreathing onClose={() => setView("menu")} />
      </div>
    );
  }

  if (view === "emergency") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-gray-900 p-8 text-white">
        <h1 className="mb-6 text-center text-2xl font-bold">
          Voce nao esta sozinho(a)
        </h1>
        <p className="mb-8 text-center text-lg text-gray-300">
          Ligue agora. Todas as linhas sao gratuitas e funcionam 24 horas.
        </p>

        <div className="space-y-4">
          <a
            href="tel:188"
            onClick={() => logSOS("called_188")}
            className="block rounded-xl bg-red-700 p-6 text-center no-underline transition-colors hover:bg-red-600"
          >
            <span className="text-4xl font-bold text-white">188</span>
            <br />
            <span className="text-lg text-red-100">
              CVV - Centro de Valorizacao da Vida
            </span>
            <br />
            <span className="text-sm text-red-200">
              24h, gratuito, sigilo garantido
            </span>
          </a>

          <a
            href="tel:192"
            onClick={() => logSOS("called_192")}
            className="block rounded-xl bg-red-800 p-6 text-center no-underline transition-colors hover:bg-red-700"
          >
            <span className="text-4xl font-bold text-white">192</span>
            <br />
            <span className="text-lg text-red-100">SAMU</span>
            <br />
            <span className="text-sm text-red-200">
              Servico de Atendimento Movel de Urgencia
            </span>
          </a>

          {/* Emergency contacts from crisis plan */}
          {contacts.map((c, i) => (
            <a
              key={i}
              href={`tel:${c.phone}`}
              onClick={() => logSOS("called_contact")}
              className="block rounded-xl bg-amber-700 p-6 text-center no-underline transition-colors hover:bg-amber-600"
            >
              <span className="text-2xl font-bold text-white">{c.name}</span>
              <br />
              <span className="text-lg text-amber-100">{c.phone}</span>
              <br />
              <span className="text-sm text-amber-200">
                Contato de confianca
              </span>
            </a>
          ))}

          {professionalPhone && (
            <a
              href={`tel:${professionalPhone}`}
              onClick={() => logSOS("called_contact")}
              className="block rounded-xl bg-green-800 p-6 text-center no-underline transition-colors hover:bg-green-700"
            >
              <span className="text-2xl font-bold text-white">
                Meu profissional
              </span>
              <br />
              <span className="text-lg text-green-100">
                {professionalPhone}
              </span>
              <br />
              <span className="text-sm text-green-200">
                Profissional de saude
              </span>
            </a>
          )}

          <div className="rounded-xl bg-red-900 p-6 text-center">
            <span className="text-3xl font-bold text-white">UPA 24h</span>
            <br />
            <span className="text-lg text-red-100">
              Va a UPA mais proxima
            </span>
            <br />
            <span className="text-sm text-red-200">
              Atendimento presencial 24 horas
            </span>
          </div>
        </div>

        {contacts.length === 0 && !professionalPhone && (
          <Link
            href="/plano-de-crise/editar"
            className="mt-4 block text-center text-sm text-amber-400 no-underline hover:text-amber-300"
          >
            Cadastre seus contatos de emergencia no Plano de Crise
          </Link>
        )}

        <button
          onClick={() => setView("menu")}
          className="mt-8 w-full rounded-lg border border-gray-600 px-4 py-3 text-gray-400 hover:bg-gray-800"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (view === "grounding") {
    return <StepByStepGrounding onClose={() => setView("menu")} />;
  }

  // Menu principal
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-gray-900 p-8 text-white">
      <h1 className="mb-2 text-center text-3xl font-bold">SOS</h1>
      <p className="mb-8 text-center text-gray-400">
        O que voce precisa agora?
      </p>

      <div className="space-y-4">
        <button
          onClick={() => goTo("emergency")}
          className="w-full rounded-xl bg-red-700 p-6 text-left transition-colors hover:bg-red-600"
        >
          <span className="text-xl font-bold">Preciso de ajuda agora</span>
          <br />
          <span className="text-sm text-red-200">
            Numeros de emergencia e contatos de confianca
          </span>
        </button>

        <button
          onClick={() => goTo("breathing")}
          className="w-full rounded-xl bg-blue-800 p-6 text-left transition-colors hover:bg-blue-700"
        >
          <span className="text-xl font-bold">Preciso me acalmar</span>
          <br />
          <span className="text-sm text-blue-200">
            Exercicio de respiracao guiado (4-7-8)
          </span>
        </button>

        <button
          onClick={() => goTo("grounding")}
          className="w-full rounded-xl bg-indigo-800 p-6 text-left transition-colors hover:bg-indigo-700"
        >
          <span className="text-xl font-bold">Nao consigo dormir</span>
          <br />
          <span className="text-sm text-indigo-200">
            Exercicio de aterramento guiado passo a passo
          </span>
        </button>

        <Link
          href="/plano-de-crise"
          className="block w-full rounded-xl border border-gray-600 p-6 text-left no-underline transition-colors hover:bg-gray-800"
        >
          <span className="text-xl font-bold text-white">
            Meu plano de crise
          </span>
          <br />
          <span className="text-sm text-gray-400">
            Contatos, medicacoes e estrategias pessoais
          </span>
        </Link>
      </div>

      <Link
        href="/hoje"
        className="mt-8 block text-center text-sm text-gray-500 no-underline hover:text-gray-300"
      >
        Voltar para o app
      </Link>
    </div>
  );
}

// ── Step-by-step grounding exercise (5-4-3-2-1) ────────────────

const GROUNDING_STEPS = [
  {
    count: 5,
    sense: "ver",
    instruction: "Olhe ao redor e identifique 5 coisas que voce pode ver.",
    color: "text-blue-400",
    bg: "bg-blue-900/30",
  },
  {
    count: 4,
    sense: "tocar",
    instruction:
      "Toque em 4 coisas ao seu redor. Sinta a textura de cada uma.",
    color: "text-green-400",
    bg: "bg-green-900/30",
  },
  {
    count: 3,
    sense: "ouvir",
    instruction: "Fique em silencio e identifique 3 sons ao seu redor.",
    color: "text-purple-400",
    bg: "bg-purple-900/30",
  },
  {
    count: 2,
    sense: "cheirar",
    instruction: "Identifique 2 cheiros. Pode ser sua roupa, o ar, qualquer coisa.",
    color: "text-amber-400",
    bg: "bg-amber-900/30",
  },
  {
    count: 1,
    sense: "saborear",
    instruction:
      "Identifique 1 sabor. Pode ser o sabor na sua boca agora.",
    color: "text-pink-400",
    bg: "bg-pink-900/30",
  },
];

function StepByStepGrounding({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const finished = step >= GROUNDING_STEPS.length;
  const current = GROUNDING_STEPS[step];

  if (finished) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-900 p-8 text-white">
        <p className="mb-4 text-2xl font-light">Exercicio concluido.</p>
        <p className="mb-2 text-lg text-gray-400">
          Voce esta presente. Voce esta seguro(a).
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Se precisar, repita o exercicio ou faca a respiracao 4-7-8.
        </p>
        <button
          onClick={onClose}
          className="rounded-lg bg-white px-6 py-3 text-lg font-medium text-gray-900 hover:bg-gray-200"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-900 p-8 text-white">
      <p className="mb-2 text-sm text-gray-400">
        Passo {step + 1} de {GROUNDING_STEPS.length}
      </p>

      <div
        className={`mb-8 flex h-32 w-32 items-center justify-center rounded-full ${current.bg}`}
      >
        <span className={`text-6xl font-bold ${current.color}`}>
          {current.count}
        </span>
      </div>

      <p className={`mb-2 text-xl font-semibold ${current.color}`}>
        {current.count} coisa{current.count > 1 ? "s" : ""} que voce pode{" "}
        {current.sense}
      </p>

      <p className="mb-8 text-center text-lg text-gray-300">
        {current.instruction}
      </p>

      <p className="mb-6 text-center text-sm text-gray-500">
        Tome o tempo que precisar. Quando estiver pronto(a), avance.
      </p>

      <div className="flex w-full gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 rounded-lg border border-gray-600 px-4 py-3 text-gray-400 hover:bg-gray-800"
          >
            Anterior
          </button>
        )}
        <button
          onClick={() => setStep(step + 1)}
          className="flex-1 rounded-lg bg-white px-4 py-3 text-lg font-medium text-gray-900 hover:bg-gray-200"
        >
          {step < GROUNDING_STEPS.length - 1 ? "Proximo" : "Concluir"}
        </button>
      </div>

      <button
        onClick={onClose}
        className="mt-6 text-sm text-gray-500 hover:text-gray-300"
      >
        Fechar
      </button>
    </div>
  );
}
