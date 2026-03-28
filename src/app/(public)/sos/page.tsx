"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QuickBreathing } from "@/components/sos/QuickBreathing";
import { SOSChatbot } from "@/components/sos/SOSChatbot";
import { DeescalationKit } from "@/components/sos/DeescalationKit";

type View = "main" | "breathing" | "grounding" | "chat" | "waiting188" | "deescalation";

const VIEW_LABELS: Record<View, string> = {
  main: "Tela principal de emergência",
  breathing: "Exercício de respiração guiada",
  grounding: "Exercício de aterramento",
  chat: "Companheiro de espera",
  waiting188: "Espera acompanhada do 188",
  deescalation: "Kit de desescalada",
};

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
  // Restore waiting188 state if returning from phone dialer
  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const pending = sessionStorage.getItem("sos_waiting188");
      if (pending) {
        sessionStorage.removeItem("sos_waiting188");
        return "waiting188";
      }
    }
    return "main";
  });
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [professionalPhone, setProfessionalPhone] = useState<string | null>(
    null,
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const announceRef = useRef<HTMLDivElement>(null);

  // Announce view changes to screen readers
  useEffect(() => {
    if (announceRef.current) {
      announceRef.current.textContent = VIEW_LABELS[view];
    }
  }, [view]);

  // Restore waiting188 when returning from phone dialer (visibilitychange)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        const pending = sessionStorage.getItem("sos_waiting188");
        if (pending) {
          sessionStorage.removeItem("sos_waiting188");
          setView("waiting188");
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    logSOS("opened");
    fetch("/api/plano-de-crise")
      .then((res) => {
        if (!res.ok) return null;
        setIsLoggedIn(true);
        return res.json();
      })
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

  const liveRegion = (
    <div ref={announceRef} className="sr-only" aria-live="assertive" role="status" />
  );

  const wrapperClass = "flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-8";

  // Persistent top bar for sub-views — direct escape back to app or SOS main
  const subViewHeader = (
    <div className="mx-auto flex w-full max-w-lg items-center justify-between pb-3">
      <button
        onClick={() => setView("main")}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        aria-label="Voltar para o SOS"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        SOS
      </button>
      <Link
        href={isLoggedIn ? "/hoje" : "/"}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-300 no-underline transition-colors hover:bg-gray-800 hover:text-white"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        {isLoggedIn ? "Voltar ao app" : "Início"}
      </Link>
    </div>
  );

  if (view === "breathing") {
    return (
      <div className={wrapperClass}>
        {subViewHeader}
        <div className="mx-auto w-full max-w-lg">
          {liveRegion}
          <QuickBreathing onClose={() => setView("main")} />
        </div>
      </div>
    );
  }

  if (view === "grounding") {
    return (
      <div className={wrapperClass}>
        {subViewHeader}
        {liveRegion}
        <StepByStepGrounding onClose={() => setView("main")} />
      </div>
    );
  }

  if (view === "deescalation") {
    return (
      <div className={wrapperClass}>
        {subViewHeader}
        {liveRegion}
        <DeescalationKit onClose={() => setView("main")} />
      </div>
    );
  }

  if (view === "chat") {
    return (
      <div className={wrapperClass}>
        {subViewHeader}
        {liveRegion}
        <SOSChatbot onClose={() => setView("main")} />
      </div>
    );
  }

  if (view === "waiting188") {
    return (
      <div className={wrapperClass}>
        {subViewHeader}
        {liveRegion}
        <SOSChatbot onClose={() => setView("main")} waitingMode />
      </div>
    );
  }

  // Main view — emergency numbers immediately visible (no intermediate menu)
  return (
    <div className={wrapperClass}>
      <div className="mx-auto w-full max-w-lg rounded-2xl bg-gray-900 p-8 text-white">
        {liveRegion}
        <h1 className="mb-2 text-center text-3xl font-bold">SOS</h1>
        <p className="mb-1 text-center text-gray-300">
          Você não precisa passar por isso sozinho(a).
        </p>
        <p className="mb-6 text-center text-sm text-gray-300">
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
            <span className="text-lg text-white">SAMU</span>
            <br />
            <span className="text-sm text-white">
              Risco imediato · 24h · gratuito
            </span>
          </a>

          <div className="rounded-xl bg-red-800 p-6 text-center">
            <a
              href="tel:188"
              onClick={() => logSOS("called_188")}
              aria-label="Ligar para o CVV 188"
              className="block no-underline"
            >
              <span className="text-4xl font-bold text-white">188</span>
              <br />
              <span className="text-lg text-white">
                CVV — Centro de Valorização da Vida
              </span>
              <br />
              <span className="text-sm text-white">
                Preciso conversar agora · 24h · gratuito · sigilo garantido
              </span>
            </a>
            {isLoggedIn && (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  onClick={() => {
                    // Persist intent BEFORE opening dialer — browser may suspend
                    // the page when phone app opens, so setTimeout is unreliable.
                    // On return (visibilitychange or remount), state is restored.
                    sessionStorage.setItem("sos_waiting188", "1");
                    logSOS("called_188");
                    logSOS("waiting_188_mode");
                    window.open("tel:188", "_self");
                    // Fallback: if browser doesn't suspend (desktop/emulator),
                    // activate waiting mode after a short delay
                    setTimeout(() => {
                      sessionStorage.removeItem("sos_waiting188"); // Clean up before state change
                      setView("waiting188");
                    }, 1500);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/25 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/35"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  Ligar 188 + companheiro de espera
                </button>
                <button
                  onClick={() => {
                    setView("chat");
                    logSOS("chat_while_waiting");
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs text-white transition-colors hover:bg-white/20"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                  </svg>
                  Só conversar por texto
                </button>
              </div>
            )}
          </div>

          {/* Trusted contacts from crisis plan */}
          {contacts.map((c, i) => (
            <div key={i} className="rounded-xl bg-amber-700 p-5 text-center">
              <span className="text-2xl font-bold text-white">{c.name}</span>
              <br />
              <span className="text-lg text-white">{c.phone}</span>
              <br />
              <span className="text-sm text-white">Contato de confiança</span>
              <div className="mt-3 flex gap-2 justify-center">
                <a
                  href={`tel:${c.phone}`}
                  onClick={() => logSOS("called_contact")}
                  aria-label={`Ligar para ${c.name}`}
                  className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-white/30"
                >
                  Ligar
                </a>
                <a
                  href={`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent("Preciso de ajuda. Estou em um momento difícil.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => logSOS("called_contact")}
                  aria-label={`Enviar WhatsApp para ${c.name}`}
                  className="rounded-lg bg-[#25D366]/80 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#25D366]"
                >
                  WhatsApp
                </a>
              </div>
            </div>
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
            <span className="text-base text-white">
              Vá à UPA mais próxima
            </span>
            <br />
            <span className="text-sm text-white">
              Atendimento presencial 24 horas
            </span>
            <a
              href="https://www.google.com/maps/search/?api=1&query=UPA+24h+perto+de+mim"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logSOS("open_maps_upa")}
              aria-label="Abrir mapa para encontrar UPA 24h próxima"
              className="mt-2 inline-block rounded-lg bg-red-800/60 px-4 py-2 text-sm text-white no-underline hover:bg-red-800"
            >
              Abrir no mapa
            </a>
          </div>

          {/* Other emergency numbers */}
          <details className="rounded-xl bg-gray-800 p-4">
            <summary className="cursor-pointer text-center text-sm font-medium text-gray-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-lg">
              Outros números de emergência
            </summary>
            <div className="mt-3 space-y-2">
              <a
                href="tel:190"
                onClick={() => logSOS("called_190")}
                aria-label="Ligar para a Polícia Militar 190"
                className="block rounded-lg bg-gray-700 p-3 text-center no-underline transition-colors hover:bg-gray-600"
              >
                <span className="text-lg font-bold text-white">190</span>
                <span className="ml-2 text-sm text-gray-300">Polícia Militar</span>
              </a>
              <a
                href="tel:193"
                onClick={() => logSOS("called_193")}
                aria-label="Ligar para o Corpo de Bombeiros 193"
                className="block rounded-lg bg-gray-700 p-3 text-center no-underline transition-colors hover:bg-gray-600"
              >
                <span className="text-lg font-bold text-white">193</span>
                <span className="ml-2 text-sm text-gray-300">Corpo de Bombeiros</span>
              </a>
              <a
                href="tel:180"
                onClick={() => logSOS("called_180")}
                aria-label="Ligar para a Central de Atendimento à Mulher 180"
                className="block rounded-lg bg-gray-700 p-3 text-center no-underline transition-colors hover:bg-gray-600"
              >
                <span className="text-lg font-bold text-white">180</span>
                <span className="ml-2 text-sm text-gray-300">Central da Mulher</span>
              </a>
              <a
                href="tel:100"
                onClick={() => logSOS("called_100")}
                aria-label="Ligar para o Disque Direitos Humanos 100"
                className="block rounded-lg bg-gray-700 p-3 text-center no-underline transition-colors hover:bg-gray-600"
              >
                <span className="text-lg font-bold text-white">100</span>
                <span className="ml-2 text-sm text-gray-300">Disque Direitos Humanos</span>
              </a>
            </div>
          </details>
        </div>

        {isLoggedIn && contacts.length === 0 && !professionalPhone && (
          <Link
            href="/plano-de-crise/editar"
            className="mb-4 block text-center text-sm text-amber-400 no-underline hover:text-amber-300"
          >
            Cadastre seus contatos de emergência no Plano de Crise
          </Link>
        )}

        {/* Coping tools below emergency numbers */}
        <div className="border-t border-gray-700 pt-6">
          <p className="mb-3 text-center text-sm text-gray-300">
            Ferramentas rápidas (1–3 min)
          </p>
          <div className="space-y-3">
            {/* De-escalation kit — bundles breathing + grounding, works offline */}
            <button
              onClick={() => {
                setView("deescalation");
                logSOS("breathing");
              }}
              className="w-full rounded-xl bg-gradient-to-r from-blue-800 to-indigo-800 p-5 text-left transition-opacity hover:opacity-90"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">Kit de desescalada</span>
                <span className="rounded-full bg-emerald-800/60 px-2 py-0.5 text-xs font-medium text-emerald-300">
                  offline
                </span>
              </div>
              <span className="text-sm text-blue-100">
                Respiração 4-7-8 + aterramento 5-4-3-2-1
              </span>
            </button>

            <button
              onClick={() => {
                setView("breathing");
                logSOS("breathing");
              }}
              className="w-full rounded-xl bg-blue-800 p-5 text-left transition-colors hover:bg-blue-700"
            >
              <span className="text-lg font-bold">Preciso me acalmar</span>
              <br />
              <span className="text-sm text-blue-100">
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
              <span className="text-lg font-bold">Estou muito ansioso(a)</span>
              <br />
              <span className="text-sm text-indigo-100">
                Aterramento guiado passo a passo
              </span>
            </button>

            {isLoggedIn ? (
              <button
                onClick={() => {
                  setView("chat");
                  logSOS("chat_from_tools");
                }}
                className="w-full rounded-xl bg-teal-800 p-5 text-left transition-colors hover:bg-teal-700"
              >
                <span className="text-lg font-bold">Preciso conversar com alguém</span>
                <br />
                <span className="text-sm text-teal-100">
                  Chat de acolhimento por texto ou voz
                </span>
              </button>
            ) : (
              <a
                href="https://cvv.org.br"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logSOS("chat_from_tools")}
                className="block w-full rounded-xl bg-teal-800 p-5 text-left no-underline transition-colors hover:bg-teal-700"
              >
                <span className="text-lg font-bold text-white">Preciso conversar com alguém</span>
                <br />
                <span className="text-sm text-teal-100">
                  Chat online do CVV (cvv.org.br) — 24h, gratuito
                </span>
              </a>
            )}

            {isLoggedIn && (
              <Link
                href="/plano-de-crise"
                className="block w-full rounded-xl border border-gray-600 p-5 text-left no-underline transition-colors hover:bg-gray-800"
              >
                <span className="text-lg font-bold text-white">
                  Meu plano de crise
                </span>
                <br />
                <span className="text-sm text-gray-300">
                  Contatos, medicações e estratégias pessoais
                </span>
              </Link>
            )}
          </div>
        </div>

        <Link
          href={isLoggedIn ? "/hoje" : "/"}
          className="mt-8 block text-center text-sm text-gray-300 no-underline hover:text-gray-300"
        >
          {isLoggedIn ? "Voltar para o app" : "Voltar para o início"}
        </Link>
      </div>
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
        <p className="mb-2 text-lg text-gray-300">
          Esse pico de sofrimento costuma diminuir. Você atravessou esses minutos.
        </p>
        <p className="mb-8 text-sm text-gray-300">
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
      <p className="mb-2 text-sm text-gray-300">
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

      <p className="mb-6 text-center text-sm text-gray-300">
        Tome o tempo que precisar. Quando estiver pronto(a), avance.
      </p>

      <div className="flex w-full gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 rounded-lg border border-gray-600 px-4 py-3 text-gray-300 hover:bg-gray-800"
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
        className="mt-6 text-sm text-gray-300 hover:text-gray-300"
      >
        Fechar
      </button>
    </div>
  );
}
