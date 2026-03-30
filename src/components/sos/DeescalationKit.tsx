"use client";

import { useState } from "react";
import { QuickBreathing } from "./QuickBreathing";

/**
 * DeescalationKit — offline-capable crisis de-escalation tools.
 *
 * Bundles breathing (4-7-8) + grounding (5-4-3-2-1) into a single
 * component for the native SOS screen. Works 100% offline — no API calls,
 * no external resources, no network dependency.
 *
 * Designed per GPT Pro B-lite audit: "kit de desescalada offline" as
 * part of v1 native core, strengthening App Store 4.2 narrative.
 */

type Tool = "menu" | "breathing" | "grounding";

const GROUNDING_STEPS = [
  { count: 5, sense: "ver", instruction: "Olhe ao redor e identifique 5 coisas que você pode ver.", color: "text-blue-400", bg: "bg-blue-900/30" },
  { count: 4, sense: "tocar", instruction: "Toque em 4 coisas ao seu redor. Sinta a textura de cada uma.", color: "text-green-400", bg: "bg-green-900/30" },
  { count: 3, sense: "ouvir", instruction: "Fique em silêncio e identifique 3 sons ao seu redor.", color: "text-purple-400", bg: "bg-purple-900/30" },
  { count: 2, sense: "cheirar", instruction: "Identifique 2 cheiros. Pode ser sua roupa, o ar, qualquer coisa.", color: "text-amber-400", bg: "bg-amber-900/30" },
  { count: 1, sense: "saborear", instruction: "Identifique 1 sabor. Pode ser o sabor na sua boca agora.", color: "text-pink-400", bg: "bg-pink-900/30" },
];

interface Props {
  onClose: () => void;
}

export function DeescalationKit({ onClose }: Props) {
  const [tool, setTool] = useState<Tool>("menu");
  const [groundingStep, setGroundingStep] = useState(0);

  if (tool === "breathing") {
    return (
      <div className="mx-auto w-full max-w-lg">
        <button
          onClick={() => setTool("menu")}
          className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Kit de desescalada
        </button>
        <QuickBreathing onClose={() => setTool("menu")} />
      </div>
    );
  }

  if (tool === "grounding") {
    const finished = groundingStep >= GROUNDING_STEPS.length;
    const current = GROUNDING_STEPS[groundingStep];

    return (
      <div className="mx-auto w-full max-w-lg">
        <button
          onClick={() => { setTool("menu"); setGroundingStep(0); }}
          className="mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <svg aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6" /></svg>
          Kit de desescalada
        </button>

        {finished ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl bg-gray-900 p-8 text-white">
            <p className="mb-4 text-2xl font-light">Exercício concluído.</p>
            <p className="mb-2 text-lg text-gray-400">
              Esse pico de sofrimento costuma diminuir. Você atravessou esses minutos.
            </p>
            <p className="mb-8 text-sm text-gray-400">
              Se precisar, repita o exercício ou faça a respiração 4-7-8.
              Se houver risco imediato, ligue 192 (SAMU) ou 188 (CVV).
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setGroundingStep(0)}
                className="rounded-lg border border-gray-600 px-5 py-3 text-gray-300 hover:bg-gray-800"
              >
                Repetir
              </button>
              <button
                onClick={() => setTool("breathing")}
                className="rounded-lg bg-blue-800 px-5 py-3 text-white hover:bg-blue-700"
              >
                Respiração 4-7-8
              </button>
              <button
                onClick={onClose}
                className="rounded-lg bg-white px-5 py-3 font-medium text-gray-900 hover:bg-gray-200"
              >
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl bg-gray-900 p-8 text-white">
            <p className="mb-2 text-sm text-gray-400">
              Passo {groundingStep + 1} de {GROUNDING_STEPS.length}
            </p>
            <div className={`mb-8 flex h-32 w-32 items-center justify-center rounded-full ${current.bg}`}>
              <span className={`text-6xl font-bold ${current.color}`}>{current.count}</span>
            </div>
            <p className={`mb-2 text-xl font-semibold ${current.color}`}>
              {current.count} coisa{current.count > 1 ? "s" : ""} que você pode {current.sense}
            </p>
            <p className="mb-8 text-center text-lg text-gray-300">{current.instruction}</p>
            <p className="mb-6 text-center text-sm text-gray-400">
              Tome o tempo que precisar. Quando estiver pronto(a), avance.
            </p>
            <div className="flex w-full gap-3">
              {groundingStep > 0 && (
                <button
                  onClick={() => setGroundingStep(groundingStep - 1)}
                  className="flex-1 rounded-lg border border-gray-600 px-4 py-3 text-gray-400 hover:bg-gray-800"
                >
                  Anterior
                </button>
              )}
              <button
                onClick={() => setGroundingStep(groundingStep + 1)}
                className="flex-1 rounded-lg bg-white px-4 py-3 font-medium text-gray-900 hover:bg-gray-200"
              >
                {groundingStep === GROUNDING_STEPS.length - 1 ? "Concluir" : "Próximo"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Menu — choose between tools
  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl bg-gray-900 p-6 text-white">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xl font-bold">Kit de desescalada</span>
        <span className="rounded-full bg-emerald-800/60 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
          funciona offline
        </span>
      </div>
      <p className="mb-5 text-sm text-gray-400">
        Ferramentas rápidas para ajudar a passar pelo momento mais difícil. Não precisam de internet.
      </p>

      <div className="space-y-3">
        <button
          onClick={() => setTool("breathing")}
          className="w-full rounded-xl bg-blue-800 p-5 text-left transition-colors hover:bg-blue-700"
        >
          <span className="text-lg font-bold">Respiração 4-7-8</span>
          <br />
          <span className="text-sm text-blue-200">
            4 ciclos guiados · ~2 minutos · acalma o sistema nervoso
          </span>
        </button>

        <button
          onClick={() => { setTool("grounding"); setGroundingStep(0); }}
          className="w-full rounded-xl bg-indigo-800 p-5 text-left transition-colors hover:bg-indigo-700"
        >
          <span className="text-lg font-bold">Aterramento 5-4-3-2-1</span>
          <br />
          <span className="text-sm text-indigo-200">
            5 sentidos, passo a passo · ~3 minutos · reduz ansiedade aguda
          </span>
        </button>
      </div>

      <button
        onClick={onClose}
        className="mt-5 w-full rounded-lg border border-gray-600 px-4 py-3 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
      >
        Voltar ao SOS
      </button>
    </div>
  );
}
