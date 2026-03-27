"use client";

import { useState, useEffect, useCallback } from "react";
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

/* ── Contextual feedback logic ─────────────────────────── */
interface SavedData {
  mood: number;
  energyLevel: number;
  anxietyLevel: number;
  irritability: number;
  sleepHours: number;
  tookMedication?: string;
  warningSigns: string[];
}

function generateFeedback(data: SavedData): { title: string; message: string; variant: "positive" | "warning" | "neutral" }[] {
  const tips: { title: string; message: string; variant: "positive" | "warning" | "neutral" }[] = [];

  // High mood + high energy → hypomania watch
  if (data.mood >= 4 && data.energyLevel >= 4) {
    tips.push({
      title: "Humor elevado com muita energia",
      message: "Pode ser um ótimo dia — mas vale observar se a energia continua subindo nos próximos dias. Manter a rotina é o melhor protetor.",
      variant: "warning",
    });
  }

  // Low mood
  if (data.mood <= 2) {
    tips.push({
      title: "Dia mais difícil",
      message: "Registrar como se sente já é um passo. Se esse padrão continuar por mais de 3 dias, considere conversar com seu profissional.",
      variant: "warning",
    });
  }

  // Short sleep
  if (data.sleepHours < 6) {
    tips.push({
      title: "Sono curto",
      message: `Você dormiu ${data.sleepHours}h — abaixo do ideal para estabilidade. Tente descansar mais cedo hoje. Sono curto pode afetar o humor nas próximas 24-48h.`,
      variant: "warning",
    });
  }

  // Excess sleep
  if (data.sleepHours > 10) {
    tips.push({
      title: "Sono longo",
      message: "Dormir mais de 10h pode estar associado a fases depressivas. Se continuar, vale registrar e conversar com seu médico.",
      variant: "warning",
    });
  }

  // High anxiety + high irritability
  if (data.anxietyLevel >= 4 && data.irritability >= 4) {
    tips.push({
      title: "Ansiedade e irritabilidade altas",
      message: "Essa combinação de humor e energia pode indicar estresse intenso ou instabilidade. Exercícios de respiração podem ajudar agora — e vale mencionar ao profissional.",
      variant: "warning",
    });
  }

  // Medication taken
  if (data.tookMedication === "sim") {
    tips.push({
      title: "Medicação tomada",
      message: "Boa adesão ao tratamento é um dos principais fatores protetores contra recaídas.",
      variant: "positive",
    });
  }

  // Medication not taken
  if (data.tookMedication === "nao") {
    tips.push({
      title: "Medicação não tomada",
      message: "Pular doses pode afetar a estabilidade. Se está tendo dificuldades, converse com seu médico — nunca ajuste sozinho.",
      variant: "warning",
    });
  }

  // Warning signs present
  if (data.warningSigns.length >= 2) {
    tips.push({
      title: `${data.warningSigns.length} sinais de alerta`,
      message: "Sinais de alerta frequentes podem indicar uma mudança de fase se aproximando. Priorize rotina e sono, e considere contato com seu profissional.",
      variant: "warning",
    });
  }

  // Everything looks good
  if (tips.length === 0) {
    tips.push({
      title: "Registro salvo",
      message: "Seus indicadores estão dentro do esperado hoje. Manter o hábito de registrar é o que faz a diferença ao longo do tempo.",
      variant: "positive",
    });
  }

  return tips.slice(0, 3); // max 3 tips
}

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
  const [feedback, setFeedback] = useState<ReturnType<typeof generateFeedback> | null>(null);

  const today = localToday();

  const navigateAway = useCallback(() => {
    router.push("/diario");
    router.refresh();
  }, [router]);

  // Auto-redirect after showing feedback
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(navigateAway, 6000);
    return () => clearTimeout(timer);
  }, [feedback, navigateAway]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const sleepHours = parseFloat(formData.get("sleepHours") as string);
    const data = {
      date: formData.get("date") as string,
      mood,
      sleepHours,
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

      // Show contextual feedback instead of immediate redirect
      const tips = generateFeedback({ mood, energyLevel, anxietyLevel, irritability, sleepHours, tookMedication, warningSigns });
      setFeedback(tips);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // ── Feedback screen (post-save) ──
  if (feedback) {
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <h1 className="mb-2 text-2xl font-bold">Check-in salvo</h1>
        <p className="mb-6 text-sm text-muted">
          Veja o que seus dados de hoje podem indicar:
        </p>

        <div className="space-y-3 mb-6">
          {feedback.map((tip, i) => (
            <Card
              key={i}
              className={`border-l-4 ${
                tip.variant === "positive" ? "border-l-green-500"
                  : tip.variant === "warning" ? "border-l-amber-500"
                  : "border-l-border"
              }`}
            >
              <p className="text-sm font-semibold">{tip.title}</p>
              <p className="mt-1 text-xs text-muted">{tip.message}</p>
            </Card>
          ))}
        </div>

        <p className="mb-4 text-[11px] text-muted italic text-center">
          Esses insights são educacionais — não substituem avaliação profissional.
        </p>

        <button
          onClick={navigateAway}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark"
        >
          Ver meus registros
        </button>
      </div>
    );
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
