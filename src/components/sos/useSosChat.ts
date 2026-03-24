"use client";

import { useState, useRef, useCallback } from "react";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  tag?: string;
  seq?: number;
}

// Static fallback when API is unavailable
const STATIC_FALLBACK =
  "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.";

export function useSosChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  const sendMessages = useCallback(async (allMessages: Message[]) => {
    setStreaming(true);
    setError(null);
    abortRef.current = new AbortController();

    // Only send user/assistant messages to API (not system).
    // Include HMAC tag for assistant messages so server can verify authenticity.
    const apiMessages = allMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        ...(m.tag ? { tag: m.tag } : {}),
        ...(m.seq != null ? { seq: m.seq } : {}),
      }));

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
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: body.text || STATIC_FALLBACK },
          ]);
          return;
        }
        if (!res.ok) {
          // Map specific HTTP errors to safe, user-friendly messages
          if (res.status === 401) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "Para usar o chat, faça login no app. Enquanto isso, ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. A respiração guiada e o aterramento funcionam sem login.",
              },
            ]);
            return;
          }
          if (res.status === 429) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content:
                  "Muitas mensagens enviadas. Aguarde alguns minutos e tente novamente. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV).",
              },
            ]);
            return;
          }
          throw new Error(body.error || "Erro ao conectar");
        }
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Sem resposta");

      const decoder = new TextDecoder();
      let assistantText = "";
      let assistantTag = "";
      let assistantSeq: number | undefined;
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
          if (data === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);
            // Guardrail replacement: server detected forbidden pattern in LLM output.
            // Replace the entire streamed text with the safe fallback.
            if (parsed.guardrail && parsed.text) {
              assistantText = parsed.text;
              const text = assistantText;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: text,
                };
                return updated;
              });
            } else if (parsed.text) {
              assistantText += parsed.text;
              const text = assistantText;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: text,
                };
                return updated;
              });
            }
            // Capture HMAC tag + seq sent by server after response completes
            if (parsed.tag && !parsed.text) {
              assistantTag = parsed.tag;
              if (parsed.seq != null) assistantSeq = parsed.seq;
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
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: text,
                  };
                  return updated;
                });
              }
              if (parsed.tag && !parsed.text) {
                assistantTag = parsed.tag;
              }
            } catch {
              // Final chunk was incomplete — safe to discard
            }
          }
        }
      }

      // Store HMAC tag on the assistant message for verification on next request
      if (assistantTag) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              tag: assistantTag,
              seq: assistantSeq,
            };
          }
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // On any error, show static fallback instead of raw error
      setMessages((prev) => {
        const cleaned =
          prev[prev.length - 1]?.role === "assistant" &&
          !prev[prev.length - 1]?.content
            ? prev.slice(0, -1)
            : prev;
        return [
          ...cleaned,
          { role: "assistant", content: STATIC_FALLBACK },
        ];
      });
    } finally {
      setStreaming(false);
    }
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    const newMessage: Message = { role: "user", content: text };
    const updated = [...messages, newMessage];
    setMessages(updated);
    setInput("");
    return { updated, sendMessages };
  }, [input, streaming, messages, sendMessages]);

  const handleVoiceSend = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || streaming) return;
      const newMessage: Message = {
        role: "user",
        content: transcript.trim(),
      };
      const updated = [...messages, newMessage];
      setMessages(updated);
      setInput("");
      return { updated, sendMessages };
    },
    [streaming, messages, sendMessages],
  );

  return {
    messages,
    setMessages,
    input,
    setInput,
    streaming,
    streamingRef,
    error,
    setError,
    abortRef,
    sendMessages,
    handleSend,
    handleVoiceSend,
  };
}
