"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import Link from "next/link";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_SCREEN_LABELS,
  type FeedbackCategory,
  type FeedbackScreen,
} from "@/lib/feedback";

const CATEGORY_OPTIONS = FEEDBACK_CATEGORIES.map((v) => ({
  value: v,
  label: FEEDBACK_CATEGORY_LABELS[v],
}));

const SCREEN_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Selecione (opcional)" },
  ...Object.entries(FEEDBACK_SCREEN_LABELS).map(([value, label]) => ({ value, label })),
];

function getClientType(): string {
  if (typeof window === "undefined") return "unknown";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone);
  if (isStandalone) return "pwa";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  if (ua.includes("chrome")) return "chrome";
  return "browser";
}

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [screen, setScreen] = useState("");
  const [canContact, setCanContact] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "support" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [originRoute, setOriginRoute] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Capture referrer as origin route (not /feedback itself)
  useEffect(() => {
    if (typeof document !== "undefined" && document.referrer) {
      try {
        const url = new URL(document.referrer);
        if (url.origin === window.location.origin && url.pathname !== "/feedback") {
          setOriginRoute(url.pathname);
        }
      } catch { /* ignore invalid referrer */ }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setErrorMsg("A mensagem precisa ter pelo menos 10 caracteres.");
      setTimeout(() => errorRef.current?.focus(), 100);
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          screen: screen || undefined,
          canContact,
          route: originRoute ?? undefined,
          appVersion: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown",
          clientType: getClientType(),
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMsg("Você já enviou vários feedbacks recentemente. Tente novamente em algumas horas.");
        return;
      }

      if (!res.ok) {
        throw new Error("Erro ao enviar feedback");
      }

      const data = await res.json();
      setStatus(data.followUp === "support" ? "support" : "success");
      setMessage("");
      setScreen("");
      setCanContact(false);
    } catch {
      setStatus("error");
      setErrorMsg("Não foi possível enviar. Tente novamente.");
    }
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-xl">
        <Alert variant="success" className="mb-4">
          Obrigado pelo seu feedback! Sua opinião nos ajuda a melhorar o Suporte Bipolar.
        </Alert>
        <p className="text-xs text-muted mb-4">
          Se precisar de apoio: <strong>CVV 188</strong> (24h) · <strong>SAMU 192</strong>
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-primary underline"
        >
          Enviar outro feedback
        </button>
      </div>
    );
  }

  if (status === "support") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert variant="success">
          Seu feedback foi recebido. Obrigado por compartilhar.
        </Alert>
        <Alert variant="danger">
          <p className="font-semibold">Se você está passando por um momento difícil:</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <strong>CVV 188</strong> — Apoio emocional 24h, gratuito
            </li>
            <li>
              <strong>SAMU 192</strong> — Emergência médica 24h, gratuito
            </li>
            <li>
              <Link href="/sos" className="underline font-medium">
                Acessar SOS / Plano de Crise →
              </Link>
            </li>
          </ul>
        </Alert>
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-primary underline"
        >
          Enviar outro feedback
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-2 text-2xl font-bold">Feedback</h1>
      <p className="mb-4 text-sm text-muted">
        Sua opinião é essencial para melhorarmos o Suporte Bipolar.
      </p>

      <Card className="mb-4 border-amber-200 bg-amber-50/50">
        <p className="text-xs text-amber-800 leading-relaxed">
          Este canal <strong>não é monitorado em tempo real</strong>.
          Em risco imediato, ligue <strong>CVV 188</strong> ou <strong>SAMU 192</strong>.{" "}
          <Link href="/sos" className="underline font-medium">
            Acessar SOS →
          </Link>
        </p>
      </Card>

      <form onSubmit={handleSubmit} noValidate>
        <Card className="space-y-5">
          {/* Categoria */}
          <div>
            <label htmlFor="fb-category" className="block text-sm font-medium mb-1">
              Tipo de feedback
            </label>
            <select
              id="fb-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Mensagem */}
          <div>
            <label htmlFor="fb-message" className="block text-sm font-medium mb-1">
              Mensagem
            </label>
            <p id="fb-message-hint" className="text-xs text-muted mb-2">
              Para proteger sua privacidade, evite incluir nomes, telefones, medicação,
              diagnóstico detalhado ou informações de crise. Este campo é para falar sobre o app.
            </p>
            <textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              required
              aria-required="true"
              aria-describedby="fb-message-hint fb-message-count"
              aria-invalid={errorMsg ? "true" : undefined}
              placeholder="Conte-nos o que pensa..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm resize-y focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <p id="fb-message-count" className="mt-1 text-xs text-muted text-right" aria-live="polite">
              {message.length}/2000
            </p>
          </div>

          {/* Tela relacionada */}
          <div>
            <label htmlFor="fb-screen" className="block text-sm font-medium mb-1">
              Tela relacionada
            </label>
            <select
              id="fb-screen"
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
            >
              {SCREEN_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Contato */}
          <div className="flex items-start gap-3">
            <input
              id="fb-contact"
              type="checkbox"
              checked={canContact}
              onChange={(e) => setCanContact(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <label htmlFor="fb-contact" className="text-sm text-muted">
              Posso entrar em contato sobre este feedback?
            </label>
          </div>

          {errorMsg && (
            <div ref={errorRef} tabIndex={-1}>
              <Alert variant="danger" className="text-sm">
                {errorMsg}
              </Alert>
            </div>
          )}

          <button
            type="submit"
            disabled={status === "sending" || message.trim().length < 10}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {status === "sending" ? "Enviando..." : "Enviar feedback"}
          </button>
        </Card>
      </form>
    </div>
  );
}
