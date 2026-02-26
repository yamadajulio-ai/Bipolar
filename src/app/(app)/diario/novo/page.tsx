"use client";

import { useState } from "react";
import { localToday } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { ScaleSelector } from "@/components/ScaleSelector";
import { WarningSignsChecklist } from "@/components/WarningSignsChecklist";
import {
  MOOD_LABELS,
  ENERGY_LABELS,
  ANXIETY_LABELS,
  IRRITABILITY_LABELS,
  MEDICATION_OPTIONS,
} from "@/lib/constants";
import clsx from "clsx";

export default function NovoDiarioPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mood, setMood] = useState(3);
  const [energyLevel, setEnergyLevel] = useState(3);
  const [anxietyLevel, setAnxietyLevel] = useState(1);
  const [irritability, setIrritability] = useState(1);
  const [tookMedication, setTookMedication] = useState<string | undefined>(undefined);
  const [warningSigns, setWarningSigns] = useState<string[]>([]);

  const today = localToday();

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
      energyLevel,
      anxietyLevel,
      irritability,
      tookMedication: tookMedication || undefined,
      warningSigns: warningSigns.length > 0 ? JSON.stringify(warningSigns) : undefined,
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

          <ScaleSelector
            label="Humor"
            value={mood}
            onChange={setMood}
            labels={MOOD_LABELS}
            required
          />

          <ScaleSelector
            label="Nível de energia"
            value={energyLevel}
            onChange={setEnergyLevel}
            labels={ENERGY_LABELS}
          />

          <ScaleSelector
            label="Nível de ansiedade"
            value={anxietyLevel}
            onChange={setAnxietyLevel}
            labels={ANXIETY_LABELS}
          />

          <ScaleSelector
            label="Irritabilidade"
            value={irritability}
            onChange={setIrritability}
            labels={IRRITABILITY_LABELS}
          />

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

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-2">
              Tomou medicação hoje?
            </label>
            <div className="flex gap-2">
              {MEDICATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTookMedication(option.value)}
                  className={clsx(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    tookMedication === option.value
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-surface text-muted hover:border-primary/50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <WarningSignsChecklist
            selected={warningSigns}
            onChange={setWarningSigns}
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
