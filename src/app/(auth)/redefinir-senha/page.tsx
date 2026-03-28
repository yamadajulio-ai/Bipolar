"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/Alert";

export default function RedefinirSenhaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <span className="text-xl font-bold text-foreground">Suporte Bipolar</span>
              <p className="mt-2 text-sm text-muted">Criar nova senha</p>
            </div>
            <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)] dark:border-border-strong">
              <div className="h-48 animate-pulse rounded-lg bg-surface-alt" />
            </div>
          </div>
        </div>
      }
    >
      <RedefinirSenhaContent />
    </Suspense>
  );
}

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Erro ao redefinir senha.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
        <div className="w-full max-w-md text-center">
          <Alert variant="danger">
            Link inválido. Solicite um novo link de recuperação.
          </Alert>
          <Link href="/recuperar-senha" className="mt-4 inline-block text-sm text-primary hover:underline">
            Recuperar senha
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-xl font-bold text-foreground no-underline">
            Suporte Bipolar
          </Link>
          <p className="mt-2 text-sm text-muted">Criar nova senha</p>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)] dark:border-border-strong">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-bg-subtle">
                <svg className="w-6 h-6 text-success-fg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                Senha redefinida!
              </h1>
              <p className="text-sm text-muted">
                Sua nova senha foi salva. Agora você pode fazer login.
              </p>
              <Link
                href="/login"
                className="inline-block rounded-[var(--radius-card)] bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
                style={{ minHeight: "44px" }}
              >
                Fazer login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="mb-4 text-lg font-semibold text-foreground">
                Criar nova senha
              </h1>
              <p className="mb-4 text-sm text-muted">
                Digite sua nova senha abaixo. Ela deve ter pelo menos 8 caracteres.
              </p>

              {error && (
                <Alert variant="danger" className="mb-4">
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                    Nova senha
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus dark:border-border-strong"
                    style={{ minHeight: "44px" }}
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-foreground mb-1">
                    Confirmar nova senha
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-2.5 text-sm text-foreground placeholder-muted focus-visible:border-control-border-focus focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-control-border-focus dark:border-border-strong"
                    style={{ minHeight: "44px" }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full rounded-[var(--radius-card)] bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                  style={{ minHeight: "44px" }}
                >
                  {loading ? "Salvando..." : "Redefinir senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
