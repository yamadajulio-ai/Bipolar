"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import Link from "next/link";

const CATEGORIES = [
  { value: "suggestion", label: "Sugestão" },
  { value: "bug", label: "Problema / Bug" },
  { value: "praise", label: "Elogio" },
  { value: "other", label: "Outro" },
] as const;

const SCREENS = [
  { value: "", label: "Selecione (opcional)" },
  { value: "hoje", label: "Hoje (Dashboard)" },
  { value: "checkin", label: "Check-in" },
  { value: "sono", label: "Sono" },
  { value: "insights", label: "Insights" },
  { value: "financeiro", label: "Financeiro" },
  { value: "rotina", label: "Rotina" },
  { value: "diario", label: "Diário" },
  { value: "planejador", label: "Agenda / Planejador" },
  { value: "exercicios", label: "Exercícios" },
  { value: "sons", label: "Sons Ambiente" },
  { value: "conteudos", label: "Conteúdos" },
  { value: "avaliacao-semanal", label: "Avaliação Semanal" },
  { value: "life-chart", label: "Life Chart" },
  { value: "cognitivo", label: "Cognitivo" },
  { value: "relatorio", label: "Relatório Mensal" },
  { value: "plano-de-crise", label: "Plano de Crise" },
  { value: "integracoes", label: "Integrações" },
  { value: "perfil", label: "Perfil de Saúde" },
  { value: "conta", label: "Conta" },
  { value: "outro", label: "Outra tela" },
] as const;

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
  const [category, setCategory] = useState<string>("suggestion");
  const [message, setMessage] = useState("");
  const [screen, setScreen] = useState("");
  const [canContact, setCanContact] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "crisis" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setErrorMsg("A mensagem precisa ter pelo menos 10 caracteres.");
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
          route: window.location.pathname,
          appVersion: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown",
          clientType: getClientType(),
        }),
      });

      if (res.status === 429) {
        setStatus("error");
        setErrorMsg("Você já enviou vários feedbacks recentemente. Tente novamente em breve.");
        return;
      }

      if (!res.ok) {
        throw new Error("Erro ao enviar feedback");
      }

      const data = await res.json();
      setStatus(data.crisis ? "crisis" : "success");
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
        <button
          onClick={() => setStatus("idle")}
          className="text-sm text-primary underline"
        >
          Enviar outro feedback
        </button>
      </div>
    );
  }

  if (status === "crisis") {
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

      <form onSubmit={handleSubmit}>
        <Card className="space-y-5">
          {/* Categoria */}
          <div>
            <label htmlFor="fb-category" className="block text-sm font-medium mb-1">
              Tipo de feedback
            </label>
            <select
              id="fb-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Mensagem */}
          <div>
            <label htmlFor="fb-message" className="block text-sm font-medium mb-1">
              Mensagem
            </label>
            <p className="text-xs text-muted mb-2">
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
              placeholder="Conte-nos o que pensa..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm resize-y"
            />
            <p className="mt-1 text-xs text-muted text-right">
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
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
            >
              {SCREENS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Contato */}
          <div className="flex items-start gap-2">
            <input
              id="fb-contact"
              type="checkbox"
              checked={canContact}
              onChange={(e) => setCanContact(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <label htmlFor="fb-contact" className="text-sm text-muted">
              Posso entrar em contato sobre este feedback?
            </label>
          </div>

          {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

          <button
            type="submit"
            disabled={status === "sending" || message.trim().length < 10}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "sending" ? "Enviando..." : "Enviar feedback"}
          </button>
        </Card>
      </form>
    </div>
  );
}
