"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";
import { AppleSignInButton } from "@/components/auth/AppleSignInButton";

const oauthErrorMessages: Record<string, string> = {
  csrf: "Erro de segurança. Tente novamente.",
  no_code: "Erro na autenticação. Tente novamente.",
  no_token: "Erro na autenticação. Tente novamente.",
  email_not_verified: "Seu e-mail não está verificado.",
  google_login_failed: "Erro ao entrar com Google. Tente novamente.",
  apple_login_failed: "Erro ao entrar com Apple. Tente novamente.",
  rate_limited: "Muitas tentativas. Aguarde alguns minutos.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      senha: formData.get("senha") as string,
    };

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error || "Erro ao fazer login.");
        return;
      }

      router.push(body.onboarded === false ? "/onboarding" : "/hoje");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)] dark:border-border-strong">
      {(error || oauthError) && (
        <Alert variant="danger" className="mb-4">
          {error || oauthErrorMessages[oauthError!] || "Erro desconhecido."}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <FormField
          label="E-mail"
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
        />
        <FormField
          label="Senha"
          name="senha"
          type="password"
          required
          placeholder="Sua senha"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[var(--radius-card)] bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="mt-3 text-center text-sm">
          <Link href="/recuperar-senha" className="text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <a
        href="/api/auth/google-login"
        className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-alt dark:border-border-strong"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Entrar com Google
      </a>

      <div className="mt-3">
        <AppleSignInButton />
      </div>

      <p className="mt-4 text-center text-sm text-muted">
        Não tem conta?{" "}
        <Link href="/cadastro" className="text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="text-xl font-bold text-foreground no-underline">
            Suporte Bipolar
          </Link>
          <p className="mt-2 text-sm text-muted">Entre na sua conta</p>
        </div>

        <Suspense fallback={<div className="rounded-[var(--radius-card)] border border-border-soft bg-surface p-6 shadow-[var(--shadow-card)] dark:border-border-strong" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
