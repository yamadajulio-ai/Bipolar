"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";

const moodOptions = [
  { value: 1, label: "Muito baixo" },
  { value: 2, label: "Baixo" },
  { value: 3, label: "Neutro" },
  { value: 4, label: "Elevado" },
  { value: 5, label: "Muito elevado" },
];

export default function NovoDiarioPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(3);

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get("date") as string,
      mood,
      sleepHours: parseFloat(formData.get("sleepHours") as string),
      note: (formData.get("note") as string) || undefined,
    };

    try {
      const res = await fetch("/api/diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Erro ao salvar registro.");
        return;
      }

      router.push("/diario");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Novo Registro</h1>

      <Card>
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <FormField
            label="Data"
            name="date"
            type="date"
            required
            value={today}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground">
              Humor <span className="text-danger">*</span>
            </label>
            <div className="mt-2 flex gap-2">
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMood(option.value)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    mood === option.value
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-muted hover:border-primary/50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <FormField
            label="Horas de sono"
            name="sleepHours"
            type="number"
            required
            min={0}
            max={24}
            step={0.5}
            placeholder="Ex: 7.5"
          />

          <FormField
            label="Nota (opcional)"
            name="note"
            textarea
            rows={3}
            maxLength={280}
            placeholder="Como você está se sentindo? (máx. 280 caracteres)"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Salvar registro"}
          </button>
        </form>
      </Card>
    </div>
  );
}
