"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { BreathingTimer } from "@/components/exercicios/BreathingTimer";
import { BREATHING_EXERCISES } from "@/lib/constants";

type BreathingKey = keyof typeof BREATHING_EXERCISES;

export default function RespiracaoPage() {
  const params = useParams();
  const router = useRouter();
  const tipo = params.tipo as string;
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  const validKeys = Object.keys(BREATHING_EXERCISES) as BreathingKey[];
  const isValid = validKeys.includes(tipo as BreathingKey);

  if (!isValid) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert variant="danger">
          Exercicio nao encontrado. Verifique o endereco e tente novamente.
        </Alert>
        <Link href="/exercicios" className="mt-4 inline-block text-sm text-primary hover:underline">
          &larr; Voltar para exercicios
        </Link>
      </div>
    );
  }

  const config = BREATHING_EXERCISES[tipo as BreathingKey];

  async function handleComplete(totalDurationSecs: number) {
    setCompleted(true);
    setSaving(true);
    try {
      await fetch("/api/exercicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseType: `respiracao_${tipo}`,
          durationSecs: totalDurationSecs,
        }),
      });
    } catch {
      // Silently fail - the exercise was still completed
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <Link href="/exercicios" className="text-sm text-primary hover:underline">
          &larr; Voltar para exercicios
        </Link>
      </div>

      <Card>
        {!completed ? (
          <div className="py-4">
            <BreathingTimer
              exerciseConfig={{
                name: config.name,
                description: config.description,
                inhale: config.inhale,
                hold: config.hold,
                exhale: config.exhale,
                holdAfter: config.holdAfter,
                cycles: config.cycles,
              }}
              onComplete={handleComplete}
            />
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 mb-4">
              <p className="text-lg font-semibold text-success">Exercicio concluido!</p>
              <p className="text-sm text-muted mt-1">
                {saving ? "Salvando sessao..." : "Sessao registrada com sucesso."}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setCompleted(false);
                }}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-alt"
              >
                Repetir exercicio
              </button>
              <button
                onClick={() => router.push("/exercicios")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </Card>

      <Alert variant="info" className="mt-4">
        Exercicio educacional. Se sentir desconforto, pare e respire normalmente.
      </Alert>
    </div>
  );
}
