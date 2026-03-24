"use client";

import type { Message } from "./useSosChat";

interface SosChatMessagesProps {
  messages: Message[];
  streaming: boolean;
  onSuggestionClick: (text: string) => void;
}

export function SosChatMessages({
  messages,
  streaming,
  onSuggestionClick,
}: SosChatMessagesProps) {
  return (
    <>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
          <div className="text-4xl" aria-hidden="true">
            &#128172;
          </div>

          {/* Explicit AI disclosure */}
          <div className="rounded-lg bg-gray-800 px-4 py-3 text-left text-xs text-gray-300 max-w-xs space-y-1.5">
            <p className="font-semibold text-gray-200">
              Antes de conversar:
            </p>
            <p>
              &#8226; Eu sou uma <strong>inteligência artificial</strong>,
              não uma pessoa.
            </p>
            <p>
              &#8226; Não substituo o CVV (188) nem profissionais de saúde.
            </p>
            <p>
              &#8226; Estou aqui para te ouvir brevemente enquanto o
              atendimento humano não chega.
            </p>
            <p>
              &#8226; Suas mensagens são processadas por IA de terceiro
              (Anthropic) para gerar respostas e{" "}
              <strong>não são armazenadas</strong> no app.
            </p>
            <p>
              &#8226; O modo voz usa reconhecimento de fala do seu navegador,
              que pode enviar áudio para processamento remoto. Se preferir
              privacidade, use texto.
            </p>
          </div>

          <p className="text-gray-400 text-xs">
            Pode digitar, usar o microfone, ou ativar o{" "}
            <strong>modo voz</strong> (experimental) para conversar sem as
            mãos.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[
              "Estou me sentindo mal",
              "Preciso de ajuda para me acalmar",
              "Não consigo parar de chorar",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onSuggestionClick(suggestion)}
                aria-label={`Enviar: ${suggestion}`}
                className="rounded-full bg-gray-800 px-3 py-1.5 min-h-[44px] text-xs text-gray-300 hover:bg-gray-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          {m.role === "system" ? (
            <div className="w-full rounded-lg bg-amber-900/40 px-4 py-2.5 text-center text-xs text-amber-200">
              {m.content}
            </div>
          ) : (
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-blue-700 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}
            >
              {m.content || (
                <span className="inline-flex gap-1" aria-label="Digitando">
                  <span className="animate-pulse">.</span>
                  <span
                    className="animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  >
                    .
                  </span>
                  <span
                    className="animate-pulse"
                    style={{ animationDelay: "0.4s" }}
                  >
                    .
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
