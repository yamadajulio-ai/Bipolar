"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRec = any;

function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

function getSpeechRecognition(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.lang = "pt-BR";
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Static fallback when API is unavailable
const STATIC_FALLBACK = "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.";

export function SOSChatbot({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasVoice] = useState(hasSpeechRecognition);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionStartRef = useRef(Date.now());

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
    };
  }, []);

  // Handoff reminders: 10 min intermediate + 20 min session timeout
  useEffect(() => {
    const reminder10 = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Enquanto conversamos, o 188 pode atender a qualquer momento. Mantenha a ligação ativa se puder.",
        },
      ]);
    }, 10 * 60 * 1000);

    const reminder20 = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "system",
          content: "Já faz um tempo que estamos conversando. Este chat é temporário — o ideal é o atendimento humano do 188 ou de um profissional. Se precisar de ajuda imediata, ligue 192 (SAMU).",
        },
      ]);
    }, 20 * 60 * 1000);

    return () => {
      clearTimeout(reminder10);
      clearTimeout(reminder20);
    };
  }, []);

  const sendMessages = useCallback(async (allMessages: Message[]) => {
    setStreaming(true);
    setError(null);
    abortRef.current = new AbortController();

    // Only send user/assistant messages to API (not system)
    const apiMessages = allMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      const res = await fetch("/api/sos/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      // Handle JSON fallback response (API unavailable)
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await res.json();
        if (body.fallback) {
          setMessages((prev) => [...prev, { role: "assistant", content: body.text || STATIC_FALLBACK }]);
          return;
        }
        if (!res.ok) {
          throw new Error(body.error || "Erro ao conectar");
        }
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sem resposta");

      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              assistantText += parsed.text;
              const text = assistantText;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: text };
                return updated;
              });
            }
          } catch {
            // Skip malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // On any error, show static fallback instead of raw error
      setMessages((prev) => {
        const cleaned = prev[prev.length - 1]?.role === "assistant" && !prev[prev.length - 1]?.content
          ? prev.slice(0, -1)
          : prev;
        return [...cleaned, { role: "assistant", content: STATIC_FALLBACK }];
      });
    } finally {
      setStreaming(false);
    }
  }, []);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessage: Message = { role: "user", content: text };
    const updated = [...messages, newMessage];
    setMessages(updated);
    setInput("");
    sendMessages(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    setListening(true);

    recognition.onresult = (event: { results: { 0?: { 0?: { transcript?: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setInput((prev) => prev + (prev ? " " : "") + transcript);
      }
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  const elapsedMin = Math.floor((Date.now() - sessionStartRef.current) / 60000);

  return (
    <div
      className="mx-auto flex max-w-lg flex-col rounded-2xl bg-gray-900 text-white"
      style={{ height: "calc(100vh - 120px)", minHeight: "400px" }}
      role="log"
      aria-label="Chat de acolhimento"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <div>
          <h2 className="text-lg font-bold">Companheiro de espera</h2>
          <p className="text-xs text-gray-400">IA de acolhimento temporário</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
          aria-label="Fechar chat"
        >
          Voltar
        </button>
      </div>

      {/* Emergency banner — always visible */}
      <div className="bg-red-900/60 px-4 py-2 text-center text-xs text-red-200" role="status">
        Risco imediato? Ligue{" "}
        <a href="tel:192" className="font-bold text-white underline">192</a> (SAMU).
        Conversar:{" "}
        <a href="tel:188" className="font-bold text-white underline">188</a> (CVV)
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
            <div className="text-4xl" aria-hidden="true">&#128172;</div>

            {/* Explicit AI disclosure */}
            <div className="rounded-lg bg-gray-800 px-4 py-3 text-left text-xs text-gray-300 max-w-xs space-y-1.5">
              <p className="font-semibold text-gray-200">Antes de conversar:</p>
              <p>&#8226; Eu sou uma <strong>inteligência artificial</strong>, não uma pessoa.</p>
              <p>&#8226; Não substituo o CVV (188) nem profissionais de saúde.</p>
              <p>&#8226; Estou aqui para te ouvir brevemente enquanto o atendimento humano não chega.</p>
              <p>&#8226; Suas mensagens são processadas por IA de terceiro (Anthropic) para gerar respostas e <strong>não são armazenadas</strong> no app.</p>
            </div>

            <p className="text-gray-400 text-xs">
              Pode digitar ou usar o microfone.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {[
                "Estou me sentindo mal",
                "Preciso de ajuda para me acalmar",
                "Não consigo parar de chorar",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    const msg: Message = { role: "user", content: suggestion };
                    setMessages([msg]);
                    sendMessages([msg]);
                  }}
                  className="rounded-full bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 transition-colors"
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
                    <span className="animate-pulse" style={{ animationDelay: "0.2s" }}>.</span>
                    <span className="animate-pulse" style={{ animationDelay: "0.4s" }}>.</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-900/50 px-3 py-2 text-xs text-red-300" role="alert">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-700 px-3 py-3">
        <div className="flex items-end gap-2">
          {hasVoice && (
            <button
              onClick={toggleVoice}
              disabled={streaming}
              className={`shrink-0 rounded-full p-2.5 transition-colors ${
                listening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              } disabled:opacity-50`}
              aria-label={listening ? "Parar de ouvir" : "Falar por voz"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder={listening ? "Ouvindo..." : "Digite aqui..."}
            rows={1}
            className="flex-1 resize-none rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            aria-label="Mensagem"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="shrink-0 rounded-full bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-500 disabled:opacity-30"
            aria-label="Enviar mensagem"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-500">
          Você está conversando com uma IA. Não substitui atendimento profissional.
          {elapsedMin >= 5 && ` (${elapsedMin} min)`}
        </p>
      </div>
    </div>
  );
}
