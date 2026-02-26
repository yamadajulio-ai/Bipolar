"use client";

import { useState, useRef, useCallback } from "react";
import { BreathingCircle } from "./BreathingCircle";

interface ExerciseConfig {
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
  cycles: number;
}

interface BreathingTimerProps {
  exerciseConfig: ExerciseConfig;
  onComplete: (totalDurationSecs: number) => void;
}

export function BreathingTimer({ exerciseConfig, onComplete }: BreathingTimerProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  const handleCycleComplete = useCallback(() => {
    setCurrentCycle((prev) => {
      const next = prev + 1;
      if (next >= exerciseConfig.cycles) {
        setIsActive(false);
        setCompleted(true);
        const elapsed = startTimeRef.current
          ? Math.round((Date.now() - startTimeRef.current) / 1000)
          : 0;
        onComplete(elapsed);
      }
      return next;
    });
  }, [exerciseConfig.cycles, onComplete]);

  function handleStart() {
    if (!isActive && !completed) {
      startTimeRef.current = Date.now();
      setIsActive(true);
    } else if (isActive) {
      setIsActive(false);
    }
  }

  function handleReset() {
    setIsActive(false);
    setCurrentCycle(0);
    setCompleted(false);
    startTimeRef.current = null;
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-2">{exerciseConfig.name}</h2>
      <p className="text-sm text-muted mb-6 text-center max-w-md">
        {exerciseConfig.description}
      </p>

      <BreathingCircle
        inhale={exerciseConfig.inhale}
        hold={exerciseConfig.hold}
        exhale={exerciseConfig.exhale}
        holdAfter={exerciseConfig.holdAfter}
        isActive={isActive}
        onCycleComplete={handleCycleComplete}
      />

      {!completed && (
        <p className="mt-4 text-sm text-muted">
          Ciclo {Math.min(currentCycle + 1, exerciseConfig.cycles)} de {exerciseConfig.cycles}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        {!completed ? (
          <>
            <button
              onClick={handleStart}
              className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
            >
              {isActive ? "Pausar" : currentCycle > 0 ? "Continuar" : "Iniciar"}
            </button>
            {(isActive || currentCycle > 0) && (
              <button
                onClick={handleReset}
                className="rounded-lg border border-border bg-surface px-6 py-2 font-medium text-foreground hover:bg-surface-alt"
              >
                Reiniciar
              </button>
            )}
          </>
        ) : (
          <button
            onClick={handleReset}
            className="rounded-lg border border-border bg-surface px-6 py-2 font-medium text-foreground hover:bg-surface-alt"
          >
            Fazer novamente
          </button>
        )}
      </div>
    </div>
  );
}
