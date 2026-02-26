"use client";

import { useState } from "react";
import { QuickBreathing } from "@/components/sos/QuickBreathing";

type View = "menu" | "emergency" | "breathing" | "grounding";

export default function SOSPage() {
  const [view, setView] = useState<View>("menu");

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
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-gray-900 p-8 text-white">
        <h1 className="mb-6 text-center text-2xl font-bold">
          Nao consigo dormir
        </h1>

        <div className="mb-8 rounded-xl bg-gray-800 p-6">
          <h2 className="mb-4 text-lg font-semibold text-blue-300">
            Exercicio de aterramento
          </h2>
          <p className="mb-4 text-gray-300">
            Deite-se confortavelmente e identifique ao seu redor:
          </p>
          <ol className="space-y-3 text-gray-200">
            <li className="text-lg">
              <span className="font-bold text-blue-400">5</span> coisas que voce pode ver
            </li>
            <li className="text-lg">
              <span className="font-bold text-blue-400">4</span> coisas que voce pode tocar
            </li>
            <li className="text-lg">
              <span className="font-bold text-blue-400">3</span> coisas que voce pode ouvir
            </li>
            <li className="text-lg">
              <span className="font-bold text-blue-400">2</span> coisas que voce pode cheirar
            </li>
            <li className="text-lg">
              <span className="font-bold text-blue-400">1</span> coisa que voce pode saborear
            </li>
          </ol>
        </div>

        <div className="rounded-xl bg-gray-800 p-6">
          <h2 className="mb-3 text-lg font-semibold text-green-300">
            Dica de respiracao
          </h2>
          <p className="text-gray-300">
            Inspire lentamente pelo nariz contando ate 4. Segure por 7 segundos.
            Expire pela boca contando ate 8. Repita ate sentir o corpo relaxar.
            Concentre-se apenas na sua respiracao.
          </p>
        </div>

        <button
          onClick={() => setView("menu")}
          className="mt-8 w-full rounded-lg border border-gray-600 px-4 py-3 text-gray-400 hover:bg-gray-800"
        >
          Voltar
        </button>
      </div>
    );
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
          onClick={() => setView("emergency")}
          className="w-full rounded-xl bg-red-700 p-6 text-left transition-colors hover:bg-red-600"
        >
          <span className="text-xl font-bold">Preciso de ajuda agora</span>
          <br />
          <span className="text-sm text-red-200">
            Numeros de emergencia e apoio imediato
          </span>
        </button>

        <button
          onClick={() => setView("breathing")}
          className="w-full rounded-xl bg-blue-800 p-6 text-left transition-colors hover:bg-blue-700"
        >
          <span className="text-xl font-bold">Preciso me acalmar</span>
          <br />
          <span className="text-sm text-blue-200">
            Exercicio de respiracao guiado
          </span>
        </button>

        <button
          onClick={() => setView("grounding")}
          className="w-full rounded-xl bg-indigo-800 p-6 text-left transition-colors hover:bg-indigo-700"
        >
          <span className="text-xl font-bold">Nao consigo dormir</span>
          <br />
          <span className="text-sm text-indigo-200">
            Exercicio de aterramento e dica de respiracao
          </span>
        </button>
      </div>

      <a
        href="/app"
        className="mt-8 block text-center text-sm text-gray-500 no-underline hover:text-gray-300"
      >
        Voltar para o app
      </a>
    </div>
  );
}
