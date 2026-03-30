"use client";

import { useState, useEffect, useRef } from "react";

const STAGES = [
  { label: "Buscando seus registros...", target: 12, duration: 3000 },
  { label: "Analisando padrões de sono...", target: 25, duration: 5000 },
  { label: "Cruzando humor e rotina...", target: 40, duration: 8000 },
  { label: "Gerando resumo com IA...", target: 80, duration: 50000 },
  { label: "Verificando segurança...", target: 95, duration: 20000 },
] as const;

const TOTAL_ESTIMATED_MS = STAGES.reduce((s, st) => s + st.duration, 0); // ~86s

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
      // Find current stage and the cumulative time of all previous stages
      let stageStart = 0;
      let currentStage = STAGES.length - 1;
      for (let i = 0; i < STAGES.length; i++) {
        if (elapsed < stageStart + STAGES[i].duration) {
          currentStage = i;
          break;
        }
        stageStart += STAGES[i].duration;
      }

      setStageIndex(currentStage);

      // Calculate progress per-stage: smooth within each stage toward its target
      const stageElapsed = elapsed - stageStart;
      const stageDuration = STAGES[currentStage].duration;
      const stageRatio = Math.min(stageElapsed / stageDuration, 1);
      const prevTarget = currentStage > 0 ? STAGES[currentStage - 1].target : 0;
      const currentTarget = STAGES[currentStage].target;
      const easedRatio = 1 - Math.pow(1 - stageRatio, 1.5);
      const pct = Math.min(prevTarget + (currentTarget - prevTarget) * easedRatio, 95);

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
