"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSosChat } from "./useSosChat";
import type { Message } from "./useSosChat";
import { useSosVoice, stopSpeaking, speak } from "./useSosVoice";
import { SosSafetyBanner } from "./SosSafetyBanner";
import { SosChatMessages } from "./SosChatMessages";
import { useState } from "react";

interface SOSChatbotProps {
  onClose: () => void;
  waitingMode?: boolean; // Activated from 188 waiting flow
}

export function SOSChatbot({ onClose, waitingMode = false }: SOSChatbotProps) {
  const [aiConsent, setAiConsent] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("sos-ai-consent") === "1";
  });

  const {
    messages,
    setMessages,
    input,
    setInput,
    streaming,
    streamingRef,
    error: chatError,
    setError: setChatError,
    abortRef,
    sendMessages,
  } = useSosChat();

  const handleVoiceSendCallback = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || streamingRef.current) return;
      const newMessage: Message = { role: "user", content: transcript.trim() };
      setMessages((prev) => {
        const updated = [...prev, newMessage];
        stopSpeaking();
        sendMessages(updated);
        return updated;
      });
      setInput("");
    },
    [sendMessages, setMessages, setInput, streamingRef],
  );

  const handleVoiceError = useCallback(
    (msg: string) => {
      if (msg) setChatError(msg);
      else setChatError(null);
    },
    [setChatError],
  );

  const voice = useSosVoice({
    onVoiceSend: handleVoiceSendCallback,
    onError: handleVoiceError,
    streaming,
    streamingRef,
    waitingMode,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionStartRef = useRef(Date.now());
  const [elapsedMin, setElapsedMin] = useState(0);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount (unless hands-free)
  useEffect(() => {
    if (!voice.handsFree) inputRef.current?.focus();
  }, [voice.handsFree]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [abortRef]);

  // Elapsed session timer (updates every 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMin(
        Math.floor((Date.now() - sessionStartRef.current) / 60000),
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Safety re-arm: when streaming ends in hands-free mode without TTS,
  // ensure the voice loop resumes (catches race conditions and iOS TTS failures)
  useEffect(() => {
    if (streaming || !voice.handsFree || voice.speaking || voice.listening)
      return;
    // If TTS is disabled, re-arm after a short delay
    if (!voice.ttsEnabled) {
      const timer = setTimeout(() => {
        if (
          voice.handsFreeRef.current &&
          !streamingRef.current &&
          !voice.speakingRef.current &&
          !voice.listening
        ) {
          voice.startContinuousListening();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    // If TTS is enabled, give TTS effect time to fire (it runs on same deps).
    // If after 3s we're still not speaking or listening, force re-arm.
    const safetyTimer = setTimeout(() => {
      if (
        voice.handsFreeRef.current &&
        !streamingRef.current &&
        !voice.speakingRef.current &&
        !voice.listening
      ) {
        voice.startContinuousListening();
      }
    }, 3000);
    return () => clearTimeout(safetyTimer);
  }, [streaming, voice.handsFree, voice.speaking, voice.listening, voice.ttsEnabled, voice, streamingRef]);

  // Handoff reminders: 10 min intermediate + 20 min session timeout
  useEffect(() => {
    const reminder10 = setTimeout(() => {
      const msg = waitingMode
        ? "O 188 pode atender a qualquer momento. Mantenha a ligação ativa — estou aqui com você enquanto espera."
        : "Enquanto conversamos, o 188 pode atender a qualquer momento. Mantenha a ligação ativa se puder.";
      setMessages((prev) => [...prev, { role: "system", content: msg }]);
      // Stop STT before TTS to prevent self-transcription
      voice.recognitionRef.current?.stop();
      voice.setListening(false);
      if (voice.ttsEnabledRef.current) {
        speak(msg);
      }
    }, 10 * 60 * 1000);

    const reminder20 = setTimeout(() => {
      const msg =
        "Já faz um tempo que estamos conversando. Este chat é temporário — o ideal é o atendimento humano do 188 ou de um profissional. Se precisar de ajuda imediata, ligue 192 (SAMU).";
      setMessages((prev) => [...prev, { role: "system", content: msg }]);
      // Stop STT before TTS to prevent self-transcription
      voice.recognitionRef.current?.stop();
      voice.setListening(false);
      if (voice.ttsEnabledRef.current) {
        speak(msg);
      }
    }, 20 * 60 * 1000);

    return () => {
      clearTimeout(reminder10);
      clearTimeout(reminder20);
    };
  }, [waitingMode, setMessages, voice]);

  // Auto-start in waiting mode: send initial greeting (only after AI consent)
  useEffect(() => {
    if (waitingMode && aiConsent && messages.length === 0) {
      const greeting: Message = {
        role: "user",
        content:
          "Estou ligando pro 188 e esperando ser atendido. Preciso de companhia enquanto espero.",
      };
      setMessages([greeting]);
      sendMessages([greeting]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingMode, aiConsent]);

  // TTS: speak new assistant messages when complete (streaming done)
  useEffect(() => {
    voice.speakAssistantMessage(messages, streaming);
  }, [messages, streaming, voice]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessage: Message = { role: "user", content: text };
    const updated = [...messages, newMessage];
    setMessages(updated);
    setInput("");
    stopSpeaking();
    voice.setSpeaking(false);
    sendMessages(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSuggestionClick(text: string) {
    const msg: Message = { role: "user", content: text };
    setMessages([msg]);
    sendMessages([msg]);
  }

  // AI consent disclosure — shown once per session before chat starts
  if (!aiConsent) {
    return (
      <div
        className="mx-auto flex max-w-lg flex-col items-center justify-center rounded-2xl bg-gray-900 px-6 py-10 text-white"
        style={{ height: "calc(100vh - 160px)", minHeight: "400px" }}
        role="alertdialog"
        aria-labelledby="ai-consent-title"
        aria-describedby="ai-consent-desc"
      >
        <h2 id="ai-consent-title" className="mb-4 text-lg font-bold text-center">
          Antes de iniciar o chat
        </h2>
        <div id="ai-consent-desc" className="mb-6 space-y-3 text-sm text-gray-300 text-center">
          <p>
            Suas mensagens serão processadas por inteligência artificial (Anthropic).
            O chat é educacional e <strong>não substitui atendimento profissional</strong>.
            Nenhuma mensagem é armazenada permanentemente pelo app
            (retenção temporária para segurança conforme política do provedor).
          </p>
          <p className="text-xs text-gray-400">
            Recursos de emergência (CVV 188, SAMU 192, respiração guiada) continuam
            acessíveis sem aceitar esta tela.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              sessionStorage.setItem("sos-ai-consent", "1");
              setAiConsent(true);
            }}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 min-h-[44px]"
          >
            Entendi, iniciar chat
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-gray-600 bg-gray-800 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700 min-h-[44px]"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex max-w-lg flex-col rounded-2xl bg-gray-900 text-white"
      style={{ height: "calc(100vh - 160px)", minHeight: "400px" }}
      role="log"
      aria-label="Chat de acolhimento"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <div>
          <h2 className="text-lg font-bold">
            {waitingMode ? "Espera acompanhada" : "Companheiro de espera"}
          </h2>
          <p className="text-xs text-gray-400">
            {waitingMode
              ? "Estou com você enquanto o 188 atende"
              : "IA de acolhimento — NÃO é serviço de emergência"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TTS toggle */}
          <button
            onClick={voice.toggleTTS}
            className={`rounded-lg p-2 min-h-[44px] min-w-[44px] text-xs transition-colors ${
              voice.ttsEnabled
                ? "bg-blue-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            aria-label={
              voice.ttsEnabled
                ? "Desativar voz do assistente"
                : "Ativar voz do assistente"
            }
            title={voice.ttsEnabled ? "Voz ativada" : "Ativar voz"}
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              {voice.ttsEnabled ? (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              ) : (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              )}
            </svg>
          </button>
          {/* Hands-free toggle */}
          {voice.hasVoice && (
            <button
              onClick={voice.toggleHandsFree}
              className={`rounded-lg px-2.5 py-2 min-h-[44px] text-xs font-medium transition-colors ${
                voice.handsFree
                  ? "bg-green-700 text-white animate-pulse"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              aria-label={
                voice.handsFree
                  ? "Desativar modo voz contínua"
                  : "Ativar modo voz contínua"
              }
              title={voice.handsFree ? "Modo voz ativo" : "Modo voz"}
            >
              {voice.handsFree ? "Voz ON" : "Voz"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
            aria-label="Fechar chat e voltar ao SOS"
          >
            Voltar
          </button>
        </div>
      </div>

      <SosSafetyBanner
        waitingMode={waitingMode}
        sttDisclosureShown={voice.sttDisclosureShown}
        onDismissSttDisclosure={voice.dismissSttDisclosure}
        handsFree={voice.handsFree}
        listening={voice.listening}
        speaking={voice.speaking}
      />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        aria-live="polite"
      >
        <SosChatMessages
          messages={messages}
          streaming={streaming}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>

      {/* Error */}
      {chatError && (
        <div
          className="mx-4 mb-2 rounded-lg bg-red-900/50 px-3 py-2 text-xs text-red-300"
          role="alert"
        >
          {chatError}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-700 px-3 py-3">
        <div className="flex items-end gap-2">
          {voice.hasVoice && !voice.handsFree && (
            <button
              onClick={() =>
                voice.toggleVoice((text) =>
                  setInput((prev) => prev + (prev ? " " : "") + text),
                )
              }
              disabled={streaming}
              className={`shrink-0 rounded-full p-3 min-h-[44px] min-w-[44px] transition-colors ${
                voice.listening
                  ? "bg-red-600 text-on-danger animate-pulse"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              } disabled:opacity-50`}
              aria-label={
                voice.listening ? "Parar de ouvir" : "Falar por voz"
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-5 w-5"
              >
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || voice.handsFree}
            placeholder={
              voice.handsFree
                ? "Modo voz ativo — fale normalmente"
                : voice.listening
                  ? "Ouvindo..."
                  : "Digite aqui..."
            }
            rows={1}
            className="flex-1 resize-none rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-600 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            aria-label="Mensagem"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || voice.handsFree}
            className="shrink-0 rounded-full bg-blue-600 p-2.5 text-white transition-colors hover:bg-blue-500 disabled:opacity-30"
            aria-label="Enviar mensagem"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-gray-500">
          Este chat NÃO é um serviço de emergência. Suas mensagens são processadas pela Anthropic (IA)
          e não são armazenadas permanentemente pelo app. Em crise, ligue 192 (SAMU) ou 188 (CVV).
          {elapsedMin >= 5 && ` (${elapsedMin} min)`}
        </p>
      </div>
    </div>
  );
}
