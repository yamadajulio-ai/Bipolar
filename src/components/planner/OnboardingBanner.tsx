"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COMMON_ROUTINES = [
  { key: "acordar", label: "Acordar", time: "07:00", duration: 30, category: "sono", kind: "ANCHOR", energy: 0 },
  { key: "cafe", label: "Cafe da manha", time: "07:30", duration: 30, category: "refeicao", kind: "ANCHOR", energy: 2 },
  { key: "almoco", label: "Almoco", time: "12:00", duration: 60, category: "refeicao", kind: "ANCHOR", energy: 2 },
  { key: "jantar", label: "Jantar", time: "19:00", duration: 60, category: "refeicao", kind: "ANCHOR", energy: 2 },
  { key: "medicacao", label: "Medicacao noturna", time: "22:00", duration: 15, category: "medicacao", kind: "ANCHOR", energy: 1 },
  { key: "dormir", label: "Dormir", time: "23:00", duration: 480, category: "sono", kind: "ANCHOR", energy: 0 },
];

export function OnboardingBanner() {
  const [step, setStep] = useState(1);
  const [wakeTime, setWakeTime] = useState("07:00");
  const [sleepTime, setSleepTime] = useState("23:00");
  const [selected, setSelected] = useState<Set<string>>(new Set(["acordar", "cafe", "almoco", "jantar", "medicacao", "dormir"]));
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (dismissed) return null;

  function toggleRoutine(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    setLoading(true);
    try {
      // 1. Save stability rules (wake/sleep targets)
      const [wH, wM] = wakeTime.split(":").map(Number);
      const [sH, sM] = sleepTime.split(":").map(Number);
      await fetch("/api/planner/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWakeTimeMin: wH * 60 + wM,
          targetSleepTimeMin: sH * 60 + sM,
        }),
      });

      // 2. Create routine blocks with DAILY recurrence
      const routines = COMMON_ROUTINES.filter((r) => selected.has(r.key));
      for (const r of routines) {
        const time = r.key === "acordar" ? wakeTime : r.key === "dormir" ? sleepTime : r.time;
        const [h, m] = time.split(":").map(Number);

        const today = new Date();
        const startAt = new Date(today);
        startAt.setHours(h, m, 0, 0);
        const endAt = new Date(startAt.getTime() + r.duration * 60000);

        await fetch("/api/planner/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: r.label,
            category: r.category,
            kind: r.kind,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            energyCost: r.energy,
            stimulation: 0,
            isRoutine: true,
            recurrence: { freq: "DAILY", interval: 1 },
          }),
        });
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
      <h2 className="text-lg font-bold text-foreground mb-1">Configure sua semana em segundos</h2>
      <p className="text-sm text-muted mb-4">
        Defina seus horarios base e escolha rotinas comuns. Voce pode ajustar tudo depois.
      </p>

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground">Horario de acordar</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Horario de dormir</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={() => setStep(2)}
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark"
          >
            Proximo
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Selecione as rotinas que deseja adicionar:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COMMON_ROUTINES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => toggleRoutine(r.key)}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                  selected.has(r.key)
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-surface text-muted hover:border-primary/50"
                }`}
              >
                <span className="font-medium">{r.label}</span>
                <span className="block text-xs text-muted">
                  {r.key === "acordar" ? wakeTime : r.key === "dormir" ? sleepTime : r.time}
                </span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || selected.size === 0}
              className="flex-1 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Gerando..." : "Gerar minha primeira semana"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setDismissed(true)}
        className="mt-3 text-xs text-muted hover:text-foreground"
      >
        Pular configuracao
      </button>
    </div>
  );
}
