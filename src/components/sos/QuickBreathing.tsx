"use client";

import { useState, useEffect, useCallback, startTransition } from "react";

type Phase = "inhale" | "hold" | "exhale";

const phases: { phase: Phase; duration: number; label: string }[] = [
  { phase: "inhale", duration: 4, label: "Inspire" },
  { phase: "hold", duration: 7, label: "Segure" },
  { phase: "exhale", duration: 8, label: "Expire" },
];

const TOTAL_CYCLES = 4;

interface QuickBreathingProps {
  onClose: () => void;
}

export function QuickBreathing({ onClose }: QuickBreathingProps) {
  const [cycle, setCycle] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(phases[0].duration);
  const [finished, setFinished] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    startTransition(() => setReducedMotion(mq.matches));
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const currentPhase = phases[phaseIndex];

  const advancePhase = useCallback(() => {
    const nextPhaseIndex = phaseIndex + 1;
    if (nextPhaseIndex < phases.length) {
      setPhaseIndex(nextPhaseIndex);
      setCountdown(phases[nextPhaseIndex].duration);
    } else {
      const nextCycle = cycle + 1;
      if (nextCycle >= TOTAL_CYCLES) {
        setFinished(true);
      } else {
        setCycle(nextCycle);
        setPhaseIndex(0);
        setCountdown(phases[0].duration);
      }
    }
  }, [phaseIndex, cycle]);

  useEffect(() => {
    if (finished) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          advancePhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [finished, advancePhase]);

  // Circle scale based on phase
  let circleScale = 1;
  if (!finished) {
    if (currentPhase.phase === "inhale") {
      const progress = 1 - countdown / currentPhase.duration;
      circleScale = 0.6 + 0.4 * progress;
    } else if (currentPhase.phase === "hold") {
      circleScale = 1;
    } else {
      const progress = 1 - countdown / currentPhase.duration;
      circleScale = 1 - 0.4 * progress;
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-2xl bg-gray-900 p-8 text-white">
      {finished ? (
        <div className="text-center">
          <p className="mb-4 text-2xl font-light">Exercício concluído.</p>
          <p className="mb-6 text-lg text-gray-400">
            Respire normalmente. Você está seguro(a).
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-white px-6 py-3 text-lg font-medium text-gray-900 hover:bg-gray-200"
          >
            Voltar
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-400">
            Ciclo {cycle + 1} de {TOTAL_CYCLES}
          </p>

          <div className="relative mb-8 flex h-48 w-48 items-center justify-center" role="timer" aria-live="off" aria-label={`${currentPhase.label}: ${countdown} segundos`}>
            <div
              className={`absolute inset-0 rounded-full border-2 border-white/30 ${reducedMotion ? "" : "transition-transform duration-1000 ease-in-out"}`}
              style={{
                transform: reducedMotion ? "scale(1)" : `scale(${circleScale})`,
                backgroundColor:
                  currentPhase.phase === "inhale"
                    ? "rgba(59, 130, 246, 0.2)"
                    : currentPhase.phase === "hold"
                      ? "rgba(139, 92, 246, 0.2)"
                      : "rgba(16, 185, 129, 0.2)",
              }}
              aria-hidden="true"
            />
            <span className="relative z-10 text-5xl font-light">
              {countdown}
            </span>
          </div>

          <p className="mb-1 text-2xl font-light" aria-live="polite">{currentPhase.label}</p>
          <p className="text-sm text-gray-400">
            Respiracao 4-7-8
          </p>

          <button
            onClick={onClose}
            className="mt-8 text-sm text-gray-400 hover:text-gray-300"
          >
            Fechar
          </button>
        </>
      )}
    </div>
  );
}
