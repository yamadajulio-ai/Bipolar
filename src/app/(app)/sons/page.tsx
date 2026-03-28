"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { SoundPlayer } from "@/components/sons/SoundPlayer";

const sounds = [
  { id: "white", name: "Ruído Branco", description: "Som uniforme para foco e relaxamento", icon: "⚪" },
  { id: "pink", name: "Ruído Rosa", description: "Tom mais suave que o branco, ideal para dormir", icon: "🌸" },
  { id: "brown", name: "Ruído Marrom", description: "Som profundo e grave, como trovão distante", icon: "🟤" },
  { id: "rain", name: "Chuva", description: "Simulação de chuva leve e constante", icon: "🌧️" },
] as const;

const timerOptions = [
  { value: 0, label: "Sem timer" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
];

export default function SonsPage() {
  const [activeSound, setActiveSound] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [timer, setTimer] = useState(0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Sons Ambiente</h1>
      <p className="text-sm text-muted">
        Sons gerados pelo navegador para ajudar no relaxamento, foco ou sono.
        Sem necessidade de download.
      </p>

      <Alert variant="info">
        Se sentir desconforto com algum som, pare imediatamente.
        Não substitui orientação profissional.
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2">
        {sounds.map((sound) => (
          <button
            key={sound.id}
            onClick={() => setActiveSound(activeSound === sound.id ? null : sound.id)}
            className="text-left"
          >
            <Card
              className={`transition-all cursor-pointer ${
                activeSound === sound.id
                  ? "ring-2 ring-primary border-primary"
                  : "hover:shadow-[var(--shadow-raised)]"
              }`}
            >
              <div className="text-2xl mb-1">{sound.icon}</div>
              <h3 className="font-semibold text-foreground">{sound.name}</h3>
              <p className="text-xs text-muted">{sound.description}</p>
              {activeSound === sound.id && (
                <span className="mt-2 inline-block text-xs font-medium text-primary">
                  Tocando...
                </span>
              )}
            </Card>
          </button>
        ))}
      </div>

      {activeSound && (
        <Card>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Volume
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="text-xs text-muted">{Math.round(volume * 100)}%</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Timer de sono
              </label>
              <div className="flex gap-2 flex-wrap">
                {timerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTimer(opt.value)}
                    className={`rounded-lg border px-3 py-1 min-h-[44px] text-xs font-medium transition-colors ${
                      timer === opt.value
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSound(null)}
              className="w-full rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-bg-subtle"
            >
              Parar som
            </button>
          </div>
        </Card>
      )}

      <SoundPlayer
        soundType={activeSound as "white" | "pink" | "brown" | "rain" | null}
        volume={volume}
        timerMinutes={timer}
        onTimerEnd={() => setActiveSound(null)}
      />
    </div>
  );
}
