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
    setLoading(true);
    setError("");
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get("email") as string,
      senha: formData.get("senha") as string,
      confirmarSenha: formData.get("confirmarSenha") as string,
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

      router.push("/app");
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
            Empresa Bipolar
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
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </button>
          </form>

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
