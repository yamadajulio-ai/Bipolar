"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SpeechRec = any;

export function isIOSPWA(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && isStandalone;
}

export function hasSpeechRecognition(): boolean {
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

export function hasTTS(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window;
}

export function speak(
  text: string,
  onEnd?: () => void,
  onError?: () => void,
) {
  if (!hasTTS()) {
    onError?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  // Try to pick a Brazilian Portuguese voice
  const voices = window.speechSynthesis.getVoices();
  const ptVoice =
    voices.find((v) => v.lang.startsWith("pt-BR")) ??
    voices.find((v) => v.lang.startsWith("pt"));
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

export function stopSpeaking() {
  if (hasTTS()) window.speechSynthesis.cancel();
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface UseSosVoiceOptions {
  onVoiceSend: (transcript: string) => void;
  onError: (msg: string) => void;
  streaming: boolean;
  streamingRef: React.RefObject<boolean>;
  waitingMode?: boolean;
}

export function useSosVoice({
  onVoiceSend,
  onError,
  streaming,
  streamingRef,
  waitingMode = false,
}: UseSosVoiceOptions) {
  const [listening, setListening] = useState(false);
  const [hasVoice] = useState(hasSpeechRecognition);
  const [ttsEnabled, setTtsEnabled] = useState(waitingMode);
  const [handsFree, setHandsFree] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [sttDisclosureShown, setSttDisclosureShown] = useState(false);
  const [sttDisclosureDismissed, setSttDisclosureDismissed] = useState(
    () => {
      if (typeof window === "undefined") return false;
      try {
        return localStorage.getItem("sos_stt_disclosure") === "1";
      } catch {
        return false;
      }
    },
  );

  const recognitionRef = useRef<SpeechRec | null>(null);
  const sttAcceptCallbackRef = useRef<(() => void) | null>(null);
  const ttsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const ttsEnabledRef = useRef(ttsEnabled);
  ttsEnabledRef.current = ttsEnabled;
  const lastSpokenIndexRef = useRef(-1);

  // Cleanup
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
      stopSpeaking();
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
    };
  }, []);

  // Load voices (needed for some browsers)
  useEffect(() => {
    if (hasTTS()) {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener("voiceschanged", handler);
      return () => {
        window.speechSynthesis.removeEventListener(
          "voiceschanged",
          handler,
        );
      };
    }
  }, []);

  // Ensure browser mic permission dialog is shown before using SpeechRecognition
  async function ensureMicPermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      // Stop tracks immediately — we just needed the permission grant
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      onError(
        "Microfone não permitido. Verifique as permissões do navegador.",
      );
      return false;
    }
  }

  // Continuous hands-free listening (auto-sends when speech ends)
  const startContinuousListening = useCallback(async () => {
    if (streamingRef.current || speakingRef.current) return;

    const granted = await ensureMicPermission();
    if (!granted) {
      setHandsFree(false);
      return;
    }

    const recognition = getSpeechRecognition(false);
    if (!recognition) return;

    recognitionRef.current = recognition;
    setListening(true);

    recognition.onresult = (event: {
      results: { 0?: { 0?: { transcript?: string } } };
    }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        onVoiceSend(transcript);
      }
      setListening(false);
    };

    recognition.onerror = (event: { error: string }) => {
      setListening(false);
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          onError(
            "Microfone não permitido. Verifique as permissões do navegador.",
          );
          setHandsFree(false);
          break;
        case "audio-capture":
          onError("Microfone não encontrado. Verifique o dispositivo.");
          setHandsFree(false);
          break;
        case "no-speech":
          if (handsFreeRef.current) {
            setTimeout(() => {
              if (
                handsFreeRef.current &&
                !streamingRef.current &&
                !speakingRef.current
              ) {
                startContinuousListening();
              }
            }, 500);
          }
          break;
        case "network":
          onError(
            "Reconhecimento de voz temporariamente indisponível. Tentando novamente...",
          );
          if (handsFreeRef.current) {
            setTimeout(() => {
              onError("");
              if (
                handsFreeRef.current &&
                !streamingRef.current &&
                !speakingRef.current
              ) {
                startContinuousListening();
              }
            }, 2000);
          }
          break;
        default:
          if (handsFreeRef.current) {
            setTimeout(() => {
              if (
                handsFreeRef.current &&
                !streamingRef.current &&
                !speakingRef.current
              ) {
                startContinuousListening();
              }
            }, 1000);
          }
          break;
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (
        handsFreeRef.current &&
        !streamingRef.current &&
        !speakingRef.current
      ) {
        if (!ttsEnabledRef.current) {
          setTimeout(() => {
            if (
              handsFreeRef.current &&
              !streamingRef.current &&
              !speakingRef.current
            ) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onVoiceSend, onError, streamingRef]);

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
    try {
      localStorage.setItem("sos_stt_disclosure", "1");
    } catch {}
    sttAcceptCallbackRef.current?.();
    sttAcceptCallbackRef.current = null;
  }

  // Single-shot voice input (appends to input field)
  function toggleVoice(appendToInput: (text: string) => void) {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    requireSttDisclosure(() => {
      void startSingleShotListening(appendToInput);
    });
  }

  async function startSingleShotListening(
    appendToInput: (text: string) => void,
  ) {
    const granted = await ensureMicPermission();
    if (!granted) return;

    const recognition = getSpeechRecognition(false);
    if (!recognition) return;

    recognitionRef.current = recognition;
    setListening(true);

    recognition.onresult = (event: {
      results: { 0?: { 0?: { transcript?: string } } };
    }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        appendToInput(transcript);
      }
      setListening(false);
    };

    recognition.onerror = (event: { error: string }) => {
      setListening(false);
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          onError(
            "Microfone não permitido. Verifique as permissões do navegador.",
          );
          break;
        case "no-speech":
          break;
        case "network":
          onError("Sem conexão para reconhecimento de voz. Use o teclado.");
          break;
        case "audio-capture":
          onError("Microfone não encontrado. Verifique o dispositivo.");
          break;
        default:
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

  // TTS: speak new assistant messages when complete (streaming done)
  const speakAssistantMessage = useCallback(
    (messages: { role: string; content: string }[], isStreaming: boolean) => {
      if (!ttsEnabledRef.current || isStreaming) return;
      const lastIdx = messages.length - 1;
      const lastMsg = messages[lastIdx];
      if (
        lastMsg?.role === "assistant" &&
        lastMsg.content &&
        lastIdx !== lastSpokenIndexRef.current
      ) {
        lastSpokenIndexRef.current = lastIdx;
        const isFirstResponse =
          messages.filter((m) => m.role === "assistant").length === 1;
        const textToSpeak = isFirstResponse
          ? "Sou uma inteligência artificial de acolhimento temporário. " +
            lastMsg.content
          : lastMsg.content;
        setSpeaking(true);

        // Safety timeout: iOS sometimes never fires onend/onerror
        if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
        const maxTime = Math.max(15000, textToSpeak.length * 80);
        ttsTimeoutRef.current = setTimeout(() => {
          if (speakingRef.current) {
            stopSpeaking();
            setSpeaking(false);
            if (handsFreeRef.current && !streamingRef.current) {
              startContinuousListening();
            }
          }
        }, maxTime);

        speak(
          textToSpeak,
          () => {
            if (ttsTimeoutRef.current)
              clearTimeout(ttsTimeoutRef.current);
            setSpeaking(false);
            if (handsFreeRef.current && !streamingRef.current) {
              startContinuousListening();
            }
          },
          () => {
            if (ttsTimeoutRef.current)
              clearTimeout(ttsTimeoutRef.current);
            setSpeaking(false);
            if (handsFreeRef.current && !streamingRef.current) {
              setTimeout(() => startContinuousListening(), 500);
            }
          },
        );
      }
    },
    [startContinuousListening, streamingRef],
  );

  return {
    listening,
    setListening,
    hasVoice,
    ttsEnabled,
    ttsEnabledRef,
    handsFree,
    handsFreeRef,
    speaking,
    setSpeaking,
    speakingRef,
    sttDisclosureShown,
    recognitionRef,
    toggleVoice,
    toggleHandsFree,
    toggleTTS,
    dismissSttDisclosure,
    startContinuousListening,
    speakAssistantMessage,
  };
}
