"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";

const timeAnchors = [
  { name: "wakeTime", label: "Horário que acordou" },
  { name: "firstContact", label: "Primeiro contato com outra pessoa" },
  { name: "mainActivityStart", label: "Início da atividade principal" },
  { name: "dinnerTime", label: "Horário do jantar" },
  { name: "bedtime", label: "Horário que foi dormir" },
];

export function RhythmForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data: Record<string, string | undefined> = {
      date: formData.get("date") as string,
    };

    for (const anchor of timeAnchors) {
      const val = formData.get(anchor.name) as string;
      if (val) data[anchor.name] = val;
    }

    const notes = formData.get("notes") as string;
    if (notes) data.notes = notes;

    try {
      const res = await fetch("/api/rotina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Erro ao salvar registro.");
        return;
      }

      router.push("/rotina");
      router.refresh();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
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

        {timeAnchors.map((anchor) => (
          <FormField
            key={anchor.name}
            label={anchor.label}
            name={anchor.name}
            type="time"
          />
        ))}

        <FormField
          label="Observações (opcional)"
          name="notes"
          textarea
          rows={3}
          maxLength={280}
          placeholder="Algo relevante sobre o dia? (máx. 280 caracteres)"
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
  );
}
