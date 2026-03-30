"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import Image from "next/image";

export default function ProfessionalPinEntry() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccess() {
    if (pin.length !== 6) {
      setError("Digite o PIN de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/acesso-profissional/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        // Session cookie was set by the API — redirect to viewer dashboard
        router.push(`/profissional/${token}/hoje`);
      } else {
        let msg = "Erro ao acessar.";
        try {
          const err = await res.json();
          msg = err?.error || msg;
        } catch { /* keep default */ }
        setError(msg);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && pin.length === 6) {
      handleAccess();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt p-4 dark:bg-surface">
      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-4">
          <Image
            src="/icon-192-transparent.png"
            alt=""
            width={48}
            height={48}
            className="rounded-lg mb-3"
          />
          <h1 className="text-xl font-bold text-center">
            Suporte Bipolar
          </h1>
          <p className="text-sm text-muted text-center mt-1">
            Painel do Profissional de Saúde
          </p>
        </div>

        <p className="mb-6 text-center text-sm text-muted">
          Digite o PIN de 6 dígitos fornecido pelo paciente para acessar os dados.
        </p>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={handleKeyDown}
          placeholder="000000"
          className="mb-4 w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.5em]"
          autoFocus
        />

        {error && (
          <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          onClick={handleAccess}
          disabled={loading || pin.length !== 6}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-50 min-h-[44px]"
        >
          {loading ? "Verificando..." : "Acessar painel do paciente"}
        </button>

        <p className="mt-4 text-center text-[10px] text-muted">
          Acesso protegido por PIN. Os dados são somente leitura.
          O paciente pode revogar este acesso a qualquer momento.
        </p>
      </Card>
    </div>
  );
}
