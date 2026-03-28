"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/Alert";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.status === 429) {
        setError("Muitas tentativas. Aguarde alguns minutos.");
        return;
      }

      // Always show success (prevent email enumeration)
      setSent(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-xl font-bold text-foreground no-underline">
            Suporte Bipolar
          </Link>
          <p className="mt-2 text-sm text-muted">Recuperar senha</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)] dark:border-border-strong">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/50">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                Verifique seu e-mail
              </h1>
              <p className="text-sm text-muted">
                Se existe uma conta com <strong>{email}</strong>, enviamos um link para redefinir sua senha. O link expira em 30 minutos.
              </p>
              <p className="text-sm text-muted">
                Não recebeu? Verifique a caixa de spam ou tente novamente.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-primary hover:underline"
              >
                Tentar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <h1 className="mb-4 text-lg font-semibold text-foreground">
                Esqueceu sua senha?
              </h1>
              <p className="mb-4 text-sm text-muted">
                Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.
              </p>

              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-border-strong"
                    style={{ minHeight: "44px" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-[var(--radius-card)] bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  style={{ minHeight: "44px" }}
                >
                  {loading ? "Enviando..." : "Enviar link de recuperação"}
                </button>
              </form>

              <Alert variant="info" className="mt-4">
                Se você tem conta Google, pode entrar diretamente pelo botão
                &quot;Entrar com Google&quot; na página de login — sem precisar de senha.
              </Alert>
            </>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <a
              href="/api/auth/google-login"
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-alt dark:border-border-strong"
              style={{ minHeight: "44px" }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </a>

            <Link
              href="/login"
              className="text-center text-sm text-primary hover:underline"
            >
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
