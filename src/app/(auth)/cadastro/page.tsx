"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";

export default function CadastroPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setErrors({});

    const formData = new FormData(e.currentTarget);

    if (!formData.get("ageGate")) {
      setError("Você precisa confirmar que tem 18 anos ou mais.");
      return;
    }
    if (!formData.get("healthConsent")) {
      setError("Você precisa consentir com o tratamento de dados de saúde.");
      return;
    }

    setLoading(true);

    const data = {
      email: formData.get("email") as string,
      senha: formData.get("senha") as string,
      confirmarSenha: formData.get("confirmarSenha") as string,
      ageGate: true,
      healthConsent: true,
    };

    try {
      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.errors) {
          setErrors(body.errors);
        } else {
          setError(body.error || "Erro ao criar conta.");
        }
        return;
      }

      router.push("/onboarding");
      router.refresh();
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
          <p className="mt-2 text-sm text-muted">Crie sua conta gratuita</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <Alert variant="info" className="mb-4">
            Este aplicativo é educacional e não substitui acompanhamento profissional.
          </Alert>

          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <FormField
              label="E-mail"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              error={errors.email?.[0]}
            />
            <FormField
              label="Senha"
              name="senha"
              type="password"
              required
              placeholder="Mínimo 8 caracteres"
              error={errors.senha?.[0]}
            />
            <FormField
              label="Confirmar senha"
              name="confirmarSenha"
              type="password"
              required
              placeholder="Repita a senha"
              error={errors.confirmarSenha?.[0]}
            />
            <label className="mb-3 flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="ageGate"
                value="true"
                required
                className="mt-0.5 rounded border-border"
              />
              <span>
                Declaro que tenho 18 anos ou mais.
              </span>
            </label>

            <label className="mb-4 flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="healthConsent"
                value="true"
                required
                className="mt-0.5 rounded border-border"
              />
              <span>
                Consinto com o tratamento de meus dados de saúde para fins de
                acompanhamento pessoal, conforme a LGPD (Art. 11, II, &quot;a&quot;).
                Posso revogar este consentimento a qualquer momento na página Minha Conta.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href="/api/auth/google-login"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Cadastrar com Google
          </a>

          <p className="mt-4 text-center text-sm text-muted">
            Já tem conta?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
