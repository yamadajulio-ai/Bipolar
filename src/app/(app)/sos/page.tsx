"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { QuickBreathing } from "@/components/sos/QuickBreathing";

type View = "main" | "breathing" | "grounding";

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
  const [view, setView] = useState<View>("main");
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [professionalPhone, setProfessionalPhone] = useState<string | null>(
    null,
  );

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

  if (view === "breathing") {
    return (
      <div className="mx-auto max-w-lg">
        <QuickBreathing onClose={() => setView("main")} />
      </div>
    );
  }

  if (view === "grounding") {
    return <StepByStepGrounding onClose={() => setView("main")} />;
  }

  // Main view — emergency numbers immediately visible (no intermediate menu)
  return (
    <div className="mx-auto max-w-lg rounded-2xl bg-gray-900 p-8 text-white">
      <h1 className="mb-2 text-center text-3xl font-bold">SOS</h1>
      <p className="mb-1 text-center text-gray-400">
        Você não precisa passar por isso sozinho(a).
      </p>
      <p className="mb-6 text-center text-sm text-gray-500">
        Se houver risco imediato, ligue 192. Se precisar conversar agora, ligue 188.
      </p>

      {/* Emergency numbers — always visible, zero clicks to reach */}
      <div className="mb-6 space-y-3">
        <a
          href="tel:192"
          onClick={() => logSOS("called_192")}
          aria-label="Ligar para o SAMU 192"
          className="block rounded-xl bg-red-700 p-6 text-center no-underline transition-colors hover:bg-red-600"
        >
          <span className="text-4xl font-bold text-white">192</span>
          <br />
          <span className="text-lg text-red-100">SAMU</span>
          <br />
          <span className="text-sm text-red-200">
            Risco imediato · 24h · gratuito
          </span>
        </a>

        <a
          href="tel:188"
          onClick={() => logSOS("called_188")}
          aria-label="Ligar para o CVV 188"
          className="block rounded-xl bg-red-800 p-6 text-center no-underline transition-colors hover:bg-red-700"
        >
          <span className="text-4xl font-bold text-white">188</span>
          <br />
          <span className="text-lg text-red-100">
            CVV — Centro de Valorização da Vida
          </span>
          <br />
          <span className="text-sm text-red-200">
            Preciso conversar agora · 24h · gratuito · sigilo garantido
          </span>
        </a>

        {/* Trusted contacts from crisis plan */}
        {contacts.map((c, i) => (
          <a
            key={i}
            href={`tel:${c.phone}`}
            onClick={() => logSOS("called_contact")}
            aria-label={`Ligar para ${c.name}`}
            className="block rounded-xl bg-amber-700 p-5 text-center no-underline transition-colors hover:bg-amber-600"
          >
            <span className="text-2xl font-bold text-white">{c.name}</span>
            <br />
            <span className="text-lg text-amber-100">{c.phone}</span>
            <br />
            <span className="text-sm text-amber-200">
              Contato de confiança
            </span>
          </a>
        ))}

        {professionalPhone && (
          <a
            href={`tel:${professionalPhone}`}
            onClick={() => logSOS("called_contact")}
            aria-label="Ligar para meu profissional de saúde"
            className="block rounded-xl bg-green-800 p-5 text-center no-underline transition-colors hover:bg-green-700"
          >
            <span className="text-2xl font-bold text-white">
              Meu profissional
            </span>
            <br />
            <span className="text-lg text-green-100">
              {professionalPhone}
            </span>
          </a>
        )}

        <div className="rounded-xl bg-red-900 p-5 text-center">
          <span className="text-2xl font-bold text-white">UPA 24h</span>
          <br />
          <span className="text-base text-red-100">
            Vá à UPA mais próxima
          </span>
          <br />
          <span className="text-sm text-red-200">
            Atendimento presencial 24 horas
          </span>
          <a
            href="https://www.google.com/maps/search/?api=1&query=UPA+24h+perto+de+mim"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => logSOS("open_maps_upa")}
            aria-label="Abrir mapa para encontrar UPA 24h próxima"
            className="mt-2 inline-block rounded-lg bg-red-800/60 px-4 py-2 text-sm text-red-100 no-underline hover:bg-red-800"
          >
            Abrir no mapa
          </a>
        </div>
      </div>

      {contacts.length === 0 && !professionalPhone && (
        <Link
          href="/plano-de-crise/editar"
          className="mb-4 block text-center text-sm text-amber-400 no-underline hover:text-amber-300"
        >
          Cadastre seus contatos de emergência no Plano de Crise
        </Link>
      )}

      {/* Coping tools below emergency numbers */}
      <div className="border-t border-gray-700 pt-6">
        <p className="mb-3 text-center text-sm text-gray-500">
          Ferramentas rápidas (1–3 min)
        </p>
        <div className="space-y-3">
          <button
            onClick={() => {
              setView("breathing");
              logSOS("breathing");
            }}
            className="w-full rounded-xl bg-blue-800 p-5 text-left transition-colors hover:bg-blue-700"
          >
            <span className="text-lg font-bold">Preciso me acalmar</span>
            <br />
            <span className="text-sm text-blue-200">
              Respiração guiada 4-7-8
            </span>
          </button>

          <button
            onClick={() => {
              setView("grounding");
              logSOS("grounding");
            }}
            className="w-full rounded-xl bg-indigo-800 p-5 text-left transition-colors hover:bg-indigo-700"
          >
            <span className="text-lg font-bold">Não consigo dormir</span>
            <br />
            <span className="text-sm text-indigo-200">
              Aterramento guiado passo a passo
            </span>
          </button>

          <Link
            href="/plano-de-crise"
            className="block w-full rounded-xl border border-gray-600 p-5 text-left no-underline transition-colors hover:bg-gray-800"
          >
            <span className="text-lg font-bold text-white">
              Meu plano de crise
            </span>
            <br />
            <span className="text-sm text-gray-400">
              Contatos, medicações e estratégias pessoais
            </span>
          </Link>
        </div>
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
    instruction: "Olhe ao redor e identifique 5 coisas que você pode ver.",
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
    instruction: "Fique em silêncio e identifique 3 sons ao seu redor.",
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
        <p className="mb-4 text-2xl font-light">Exercício concluído.</p>
        <p className="mb-2 text-lg text-gray-400">
          Esse pico de sofrimento costuma diminuir. Você atravessou esses minutos.
        </p>
        <p className="mb-8 text-sm text-gray-500">
          Se precisar, repita o exercício ou faça a respiração 4-7-8.
          Se houver risco imediato, ligue 192 (SAMU) ou 188 (CVV).
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
        {current.count} coisa{current.count > 1 ? "s" : ""} que você pode{" "}
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
          {step < GROUNDING_STEPS.length - 1 ? "Próximo" : "Concluir"}
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
