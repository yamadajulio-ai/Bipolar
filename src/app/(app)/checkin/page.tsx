"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ScaleSelector } from "@/components/ScaleSelector";
import { MOOD_LABELS, ENERGY_LABELS, ANXIETY_LABELS, IRRITABILITY_LABELS, MEDICATION_OPTIONS, WARNING_SIGNS } from "@/lib/constants";

export default function CheckinPage() {
  const router = useRouter();
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState(1);
  const [irritability, setIrritability] = useState(1);
  const [sleepHours, setSleepHours] = useState("7");
  const [medication, setMedication] = useState("sim");
  const [showSigns, setShowSigns] = useState(false);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const toggleSign = useCallback((key: string) => {
    setSelectedSigns((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          mood,
          sleepHours: parseFloat(sleepHours) || 0,
          energyLevel: energy,
          anxietyLevel: anxiety,
          irritability,
          tookMedication: medication,
          warningSigns: selectedSigns.length > 0 ? JSON.stringify(selectedSigns) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || body.errors?.geral?.[0] || "Erro ao salvar check-in.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/hoje"), 1500);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-center py-8">
          <p className="text-lg font-semibold text-foreground">Check-in salvo!</p>
          <p className="text-sm text-muted mt-2">Redirecionando...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">Check-in Rapido</h1>
      <p className="mb-6 text-sm text-muted">
        Como voce esta agora? Leva menos de 30 segundos.
      </p>

      {error && (
        <Alert variant="danger" className="mb-4">{error}</Alert>
      )}

      <div className="space-y-5">
        {/* Mood */}
        <Card>
          <ScaleSelector
            label="Humor"
            value={mood}
            onChange={setMood}
            labels={MOOD_LABELS}
          />
        </Card>

        {/* Energy */}
        <Card>
          <ScaleSelector
            label="Energia"
            value={energy}
            onChange={setEnergy}
            labels={ENERGY_LABELS}
          />
        </Card>

        {/* Anxiety */}
        <Card>
          <ScaleSelector
            label="Ansiedade"
            value={anxiety}
            onChange={setAnxiety}
            labels={ANXIETY_LABELS}
          />
        </Card>

        {/* Irritability */}
        <Card>
          <ScaleSelector
            label="Irritabilidade"
            value={irritability}
            onChange={setIrritability}
            labels={IRRITABILITY_LABELS}
          />
        </Card>

        {/* Sleep */}
        <Card>
          <label className="block text-sm font-medium text-foreground mb-2">
            Horas de sono
          </label>
          <input
            type="number"
            min={0}
            max={24}
            step={0.5}
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </Card>

        {/* Medication */}
        <Card>
          <label className="block text-sm font-medium text-foreground mb-2">Medicacao</label>
          <div className="flex gap-2">
            {MEDICATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMedication(opt.value)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  medication === opt.value
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-muted hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Warning signs (collapsible) */}
        <Card>
          <button
            type="button"
            onClick={() => setShowSigns(!showSigns)}
            className="flex w-full items-center justify-between text-sm font-medium text-foreground"
          >
            <span>Sinais de alerta {selectedSigns.length > 0 && `(${selectedSigns.length})`}</span>
            <span className="text-muted">{showSigns ? "▲" : "▼"}</span>
          </button>
          {showSigns && (
            <div className="mt-3 space-y-2">
              {WARNING_SIGNS.map((sign) => (
                <label key={sign.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedSigns.includes(sign.key)}
                    onChange={() => toggleSign(sign.key)}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">{sign.label}</span>
                </label>
              ))}
            </div>
          )}
        </Card>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar check-in"}
        </button>

        <p className="text-center text-xs text-muted">
          Para registro detalhado, use o{" "}
          <a href="/diario/novo" className="text-primary hover:underline">diario completo</a>.
        </p>
      </div>
    </div>
  );
}
