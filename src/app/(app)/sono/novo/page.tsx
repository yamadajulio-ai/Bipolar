"use client";

import { useState, useCallback } from "react";
import { localToday } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/FormField";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";
import { SleepRoutineChecklist } from "@/components/SleepRoutineChecklist";

const qualityOptions = [
  { value: 20, label: "Péssima" },
  { value: 40, label: "Ruim" },
  { value: 60, label: "Regular" },
  { value: 80, label: "Boa" },
  { value: 100, label: "Ótima" },
];

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function calculateTotalHours(bedtime: string, wakeTime: string): number {
  if (!bedtime || !wakeTime) return 0;
  const [bedH, bedM] = bedtime.split(":").map(Number);
  const [wakeH, wakeM] = wakeTime.split(":").map(Number);
  const bedMinutes = bedH * 60 + bedM;
  let wakeMinutes = wakeH * 60 + wakeM;
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }
  const diff = (wakeMinutes - bedMinutes) / 60;
  return Math.round(diff * 10) / 10;
}

export default function NovoSonoPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quality, setQuality] = useState(60);
  const [bedtime, setBedtime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>([]);

  const today = localToday();
  const totalHours = calculateTotalHours(bedtime, wakeTime);

  const handleRoutineChange = useCallback((selected: string[]) => {
    setSelectedRoutines(selected);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get("date") as string,
      bedtime,
      wakeTime,
      totalHours,
      quality,
      awakenings: parseInt(formData.get("awakenings") as string, 10) || 0,
      preRoutine: selectedRoutines.length > 0 ? JSON.stringify(selectedRoutines) : undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch("/api/sono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Erro ao salvar registro de sono.");
        return;
      }

      router.push("/sono");
      router.refresh();
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Novo Registro de Sono</h1>

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
            <label htmlFor="bedtime" className="block text-sm font-medium text-foreground">
              Horario de dormir <span className="text-danger ml-1">*</span>
            </label>
            <input
              id="bedtime"
              type="time"
              value={bedtime}
              onChange={(e) => setBedtime(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="wakeTime" className="block text-sm font-medium text-foreground">
              Horario de acordar <span className="text-danger ml-1">*</span>
            </label>
            <input
              id="wakeTime"
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mb-4 rounded-lg border border-border bg-surface-alt px-3 py-2">
            <p className="text-sm text-muted">
              Total calculado: <span className="font-semibold text-foreground">{formatDuration(totalHours)}</span>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground">
              Qualidade do sono <span className="text-danger">*</span>
            </label>
            <div className="mt-2 flex gap-2">
              {qualityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setQuality(option.value)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                    quality === option.value
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
            label="Despertares durante a noite"
            name="awakenings"
            type="number"
            min={0}
            max={10}
            value={0}
            placeholder="0"
          />

          <SleepRoutineChecklist
            selected={selectedRoutines}
            onChange={handleRoutineChange}
          />

          <FormField
            label="Observacoes (opcional)"
            name="notes"
            textarea
            rows={3}
            maxLength={280}
            placeholder="Como foi sua noite de sono? (max. 280 caracteres)"
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
