"use client";

import { useState, useEffect, useRef } from "react";

const STAGES = [
  { label: "Buscando seus registros...", target: 15, duration: 2000 },
  { label: "Analisando padrões de sono...", target: 30, duration: 3000 },
  { label: "Cruzando humor e rotina...", target: 50, duration: 5000 },
  { label: "Gerando resumo com IA...", target: 75, duration: 15000 },
  { label: "Verificando segurança...", target: 90, duration: 10000 },
] as const;

const TOTAL_ESTIMATED_MS = STAGES.reduce((s, st) => s + st.duration, 0); // ~35s

interface NarrativeProgressProps {
  active: boolean;
}

export function NarrativeProgress({ active }: NarrativeProgressProps) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const startTime = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      queueMicrotask(() => { setProgress(0); setStageIndex(0); });
      return;
    }

    startTime.current = Date.now();

    function tick() {
      const elapsed = Date.now() - startTime.current;
      // Find current stage
      let cumulative = 0;
      let currentStage = 0;
      for (let i = 0; i < STAGES.length; i++) {
        if (elapsed < cumulative + STAGES[i].duration) {
          currentStage = i;
          break;
        }
        cumulative += STAGES[i].duration;
        if (i === STAGES.length - 1) currentStage = i;
      }

      setStageIndex(currentStage);

      // Calculate progress: ease-out curve that slows down near 95%
      const ratio = Math.min(elapsed / TOTAL_ESTIMATED_MS, 1);
      // Ease-out: fast start, slow finish — never reaches 100%
      const eased = 1 - Math.pow(1 - ratio, 2);
      const pct = Math.min(eased * 95, 95); // Cap at 95%

      setProgress(pct);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  if (!active) return null;

  const stage = STAGES[stageIndex];

  return (
    <div className="space-y-3 py-6" role="status" aria-live="polite">
      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-border/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stage label + percentage */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{stage.label}</span>
        <span className="text-xs font-medium text-primary tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
