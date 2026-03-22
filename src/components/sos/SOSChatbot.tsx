"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRec = any;

function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && isStandalone;
}

function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  if (isIOSPWA()) return false; // STT unreliable in iOS PWA/A2HS
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

function getSpeechRecognition(continuous: boolean): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  const recognition = new SR();
  recognition.lang = "pt-BR";
  recognition.continuous = continuous;
  recognition.interimResults = false;
  return recognition;
}

function hasTTS(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

function speak(text: string, onEnd?: () => void, onError?: () => void) {
  if (!hasTTS()) { onError?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  // Try to pick a Brazilian Portuguese voice
  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find((v) => v.lang.startsWith("pt-BR")) ?? voices.find((v) => v.lang.startsWith("pt"));
  if (ptVoice) utterance.voice = ptVoice;
  if (onEnd) utterance.onend = onEnd;
  // Handle TTS errors — prevent speaking state from getting stuck.
  // NOTE: Do NOT call onEnd here — the native 'end' event fires AFTER 'error'
  // per Web Speech API spec, so onEnd will be called via utterance.onend.
  // Calling onEnd here too would double-fire (e.g., startContinuousListening twice).
  utterance.onerror = () => {
    onError?.();
  };
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (hasTTS()) window.speechSynthesis.cancel();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Static fallback when API is unavailable
const STATIC_FALLBACK = "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.";

interface SOSChatbotProps {
  onClose: () => void;
  waitingMode?: boolean; // Activated from 188 waiting flow
}

export function SOSChatbot({ onClose, waitingMode = false }: SOSChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasVoice] = useState(hasSpeechRecognition);
  const [ttsEnabled, setTtsEnabled] = useState(waitingMode); // Auto-enable TTS in waiting mode
  const [handsFree, setHandsFree] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sttDisclosureShown, setSttDisclosureShown] = useState(false);
  const [sttDisclosureDismissed, setSttDisclosureDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("sos_stt_disclosure") === "1"; } catch { return false; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const sttAcceptCallbackRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionStartRef = useRef(Date.now());
  const lastSpokenIndexRef = useRef(-1);
  const [elapsedMin, setElapsedMin] = useState(0);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount (unless hands-free)
  useEffect(() => {
    if (!handsFree) inputRef.current?.focus();
  }, [handsFree]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
      stopSpeaking();
    };
  }, []);

  // Elapsed session timer (updates every 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMin(Math.floor((Date.now() - sessionStartRef.current) / 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load voices (needed for some browsers)
  useEffect(() => {
    if (hasTTS()) {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", handler);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", handler);
      };
    }
  }, []);

  // Handoff reminders: 10 min intermediate + 20 min session timeout
  // Use ref for ttsEnabled to avoid restarting timers when TTS is toggled
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;

  useEffect(() => {
    const reminder10 = setTimeout(() => {
      const msg = waitingMode
        ? "O 188 pode atender a qualquer momento. Mantenha a ligação ativa — estou aqui com você enquanto espera."
        : "Enquanto conversamos, o 188 pode atender a qualquer momento. Mantenha a ligação ativa se puder.";
      setMessages((prev) => [...prev, { role: "system", content: msg }]);
      // Stop STT before TTS to prevent self-transcription
      recognitionRef.current?.stop();
      setListening(false);
      if (ttsEnabledRef.current) speak(msg);
    }, 10 * 60 * 1000);

    const reminder20 = setTimeout(() => {
      const msg = "Já faz um tempo que estamos conversando. Este chat é temporário — o ideal é o atendimento humano do 188 ou de um profissional. Se precisar de ajuda imediata, ligue 192 (SAMU).";
      setMessages((prev) => [...prev, { role: "system", content: msg }]);
      // Stop STT before TTS to prevent self-transcription
      recognitionRef.current?.stop();
      setListening(false);
      if (ttsEnabledRef.current) speak(msg);
    }, 20 * 60 * 1000);

    return () => {
      clearTimeout(reminder10);
      clearTimeout(reminder20);
    };
  }, [waitingMode]); // Only restart timers when waitingMode changes, not ttsEnabled

  // Auto-start in waiting mode: send initial greeting
  useEffect(() => {
    if (waitingMode && messages.length === 0) {
      const greeting: Message = {
        role: "user",
        content: "Estou ligando pro 188 e esperando ser atendido. Preciso de companhia enquanto espero.",
      };
      setMessages([greeting]);
      sendMessages([greeting]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingMode]);

  // TTS: speak new assistant messages when complete (streaming done)
  useEffect(() => {
    if (!ttsEnabled || streaming) return;
    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    if (lastMsg?.role === "assistant" && lastMsg.content && lastIdx !== lastSpokenIndexRef.current) {
      lastSpokenIndexRef.current = lastIdx;
      // Prepend AI disclosure to the first assistant message for TTS
      const isFirstResponse = messages.filter(m => m.role === "assistant").length === 1;
      const textToSpeak = isFirstResponse
        ? "Sou uma inteligência artificial de acolhimento temporário. " + lastMsg.content
        : lastMsg.content;
      setSpeaking(true);
      speak(
        textToSpeak,
        () => {
          setSpeaking(false);
          // In hands-free mode, auto-start listening after TTS finishes
          if (handsFree && !streaming) {
            startContinuousListening();
          }
        },
        () => {
          // TTS error — clear speaking state to unblock the voice cycle
          setSpeaking(false);
        },
      );
    }
  }, [messages, streaming, ttsEnabled, handsFree]);

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
          // Map specific HTTP errors to safe, user-friendly messages
          if (res.status === 401) {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "Para usar o chat, faça login no app. Enquanto isso, ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. A respiração guiada e o aterramento funcionam sem login.",
            }]);
            return;
          }
          if (res.status === 429) {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: "Muitas mensagens enviadas. Aguarde alguns minutos e tente novamente. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV).",
            }]);
            return;
          }
          throw new Error(body.error || "Erro ao conectar");
        }
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sem resposta");

      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";
      let streamDone = false;

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { streamDone = true; break; }

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
            // Incomplete JSON chunk — will be completed when next chunk arrives
          }
        }
        if (streamDone) break;
      }

      // Process any remaining data in the buffer after stream ends
      if (buffer.trim()) {
        const remaining = buffer.trim();
        if (remaining.startsWith("data: ")) {
          const data = remaining.slice(6).trim();
          if (data !== "[DONE]") {
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
              // Final chunk was incomplete — safe to discard
            }
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
    stopSpeaking();
    setSpeaking(false);
    sendMessages(updated);
  }

  function handleVoiceSend(transcript: string) {
    if (!transcript.trim() || streaming) return;
    const newMessage: Message = { role: "user", content: transcript.trim() };
    const updated = [...messages, newMessage];
    setMessages(updated);
    setInput("");
    stopSpeaking();
    setSpeaking(false);
    sendMessages(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // STT privacy disclosure — show once before first mic activation
  function requireSttDisclosure(onAccept: () => void) {
    if (sttDisclosureDismissed) {
      onAccept();
      return;
    }
    setSttDisclosureShown(true);
    sttAcceptCallbackRef.current = onAccept;
  }

  function dismissSttDisclosure() {
    setSttDisclosureShown(false);
    setSttDisclosureDismissed(true);
    try { localStorage.setItem("sos_stt_disclosure", "1"); } catch {}
    sttAcceptCallbackRef.current?.();
    sttAcceptCallbackRef.current = null;
  }

  // Ensure browser mic permission dialog is shown before using SpeechRecognition
  async function ensureMicPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately — we just needed the permission grant
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      setError("Microfone não permitido. Verifique as permissões do navegador.");
      return false;
    }
  }

  // Single-shot voice input (appends to input field)
  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    requireSttDisclosure(() => {
      void startSingleShotListening();
    });
  }

  async function startSingleShotListening() {
    const granted = await ensureMicPermission();
    if (!granted) return;

    const recognition = getSpeechRecognition(false);
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

    recognition.onerror = (event: { error: string }) => {
      setListening(false);
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          setError("Microfone não permitido. Verifique as permissões do navegador.");
          break;
        case "no-speech":
          // Silent — just stop listening, user can retry
          break;
        case "network":
          setError("Sem conexão para reconhecimento de voz. Use o teclado.");
          break;
        case "audio-capture":
          setError("Microfone não encontrado. Verifique o dispositivo.");
          break;
        default:
          // Don't show error for transient issues
          break;
      }
    };
    recognition.onend = () => setListening(false);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  // Continuous hands-free listening (auto-sends when speech ends)
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;

  async function startContinuousListening() {
    if (streaming || speaking) return;

    const granted = await ensureMicPermission();
    if (!granted) { setHandsFree(false); return; }

    const recognition = getSpeechRecognition(false);
    if (!recognition) return;

    recognitionRef.current = recognition;
    setListening(true);

    recognition.onresult = (event: { results: { 0?: { 0?: { transcript?: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        handleVoiceSend(transcript);
      }
      setListening(false);
    };

    recognition.onerror = (event: { error: string }) => {
      setListening(false);
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          // Fatal — can't recover, fall back to text mode
          setError("Microfone não permitido. Verifique as permissões do navegador.");
          setHandsFree(false);
          break;
        case "audio-capture":
          // Fatal — no mic available
          setError("Microfone não encontrado. Verifique o dispositivo.");
          setHandsFree(false);
          break;
        case "no-speech":
          // Transient — retry after short delay if still in hands-free mode
          if (handsFreeRef.current) {
            setTimeout(() => {
              if (handsFreeRef.current && !streaming && !speaking) {
                startContinuousListening();
              }
            }, 500);
          }
          break;
        case "network":
          // Transient — retry once, then fall back
          setError("Reconhecimento de voz temporariamente indisponível. Tentando novamente...");
          if (handsFreeRef.current) {
            setTimeout(() => {
              setError(null);
              if (handsFreeRef.current && !streaming && !speaking) {
                startContinuousListening();
              }
            }, 2000);
          }
          break;
        default:
          // Unknown — retry once if hands-free
          if (handsFreeRef.current) {
            setTimeout(() => {
              if (handsFreeRef.current && !streaming && !speaking) {
                startContinuousListening();
              }
            }, 1000);
          }
          break;
      }
    };
    recognition.onend = () => {
      setListening(false);
      // If hands-free and no TTS pending (no new assistant message to speak),
      // re-arm listening after a short delay to maintain the loop
      if (handsFreeRef.current && !streaming && !speaking) {
        // TTS onend callback handles restart after speaking;
        // this handles the case where there's no TTS (e.g., ttsEnabled was toggled off)
        if (!ttsEnabledRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current && !streaming && !speaking) {
              startContinuousListening();
            }
          }, 300);
        }
      }
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  function toggleHandsFree() {
    if (handsFree) {
      // Turn off
      setHandsFree(false);
      recognitionRef.current?.stop();
      setListening(false);
      stopSpeaking();
      setSpeaking(false);
    } else {
      // Turn on — require STT disclosure first
      requireSttDisclosure(() => {
        setHandsFree(true);
        setTtsEnabled(true);
        // Start listening if not currently streaming or speaking
        if (!streaming && !speaking) {
          startContinuousListening();
        }
      });
    }
  }

  function toggleTTS() {
    if (ttsEnabled) {
      stopSpeaking();
      setSpeaking(false);
    }
    setTtsEnabled(!ttsEnabled);
  }

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
          <h2 className="text-lg font-bold">
            {waitingMode ? "Espera acompanhada" : "Companheiro de espera"}
          </h2>
          <p className="text-xs text-gray-400">
            {waitingMode ? "Estou com você enquanto o 188 atende" : "IA de acolhimento — não é profissional de saúde"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* TTS toggle */}
          <button
            onClick={toggleTTS}
            className={`rounded-lg p-2 text-xs transition-colors ${
              ttsEnabled
                ? "bg-blue-700 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
            aria-label={ttsEnabled ? "Desativar voz do assistente" : "Ativar voz do assistente"}
            title={ttsEnabled ? "Voz ativada" : "Ativar voz"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              {ttsEnabled ? (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              ) : (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              )}
            </svg>
          </button>
          {/* Hands-free toggle */}
          {hasVoice && (
            <button
              onClick={toggleHandsFree}
              className={`rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                handsFree
                  ? "bg-green-700 text-white animate-pulse"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
              aria-label={handsFree ? "Desativar modo voz contínua" : "Ativar modo voz contínua"}
              title={handsFree ? "Modo voz ativo" : "Modo voz"}
            >
              {handsFree ? "Voz ON" : "Voz"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
            aria-label="Fechar chat"
          >
            Voltar
          </button>
        </div>
      </div>

      {/* Emergency banner — always visible */}
      <div className="bg-red-900/60 px-4 py-2 text-center text-xs text-red-200" role="status">
        Risco imediato? Ligue{" "}
        <a href="tel:192" className="font-bold text-white underline">192</a> (SAMU).
        Conversar:{" "}
        <a href="tel:188" className="font-bold text-white underline">188</a> (CVV)
      </div>

      {/* STT privacy disclosure — shown once on first mic use */}
      {sttDisclosureShown && (
        <div className="bg-amber-900/60 px-4 py-3 text-xs text-amber-200">
          <p className="mb-2">
            <strong>Aviso de privacidade:</strong> o reconhecimento de voz do navegador pode enviar áudio
            para servidores externos (Google, Apple) para transcrição. Nenhum áudio é armazenado pelo app.
          </p>
          <p className="mb-2">Se preferir privacidade total, use o teclado.</p>
          <button
            onClick={dismissSttDisclosure}
            className="rounded-lg bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
          >
            Entendi, ativar voz
          </button>
        </div>
      )}

      {/* Hands-free mode indicator */}
      {handsFree && (
        <div className="bg-green-900/40 px-4 py-2 text-center text-xs text-green-300">
          Modo voz (experimental) — fale naturalmente, o app ouve e responde em voz alta
          {listening && <span className="ml-2 animate-pulse text-green-200">Ouvindo...</span>}
          {speaking && <span className="ml-2 text-blue-300">Falando...</span>}
        </div>
      )}

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
              <p>&#8226; O modo voz usa reconhecimento de fala do seu navegador, que pode enviar áudio para processamento remoto. Se preferir privacidade, use texto.</p>
            </div>

            <p className="text-gray-400 text-xs">
              Pode digitar, usar o microfone, ou ativar o <strong>modo voz</strong> (experimental) para conversar sem as mãos.
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
          {hasVoice && !handsFree && (
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
            disabled={streaming || handsFree}
            placeholder={
              handsFree
                ? "Modo voz ativo — fale normalmente"
                : listening
                  ? "Ouvindo..."
                  : "Digite aqui..."
            }
            rows={1}
            className="flex-1 resize-none rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600 disabled:opacity-50"
            style={{ maxHeight: "120px" }}
            aria-label="Mensagem"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || handsFree}
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
