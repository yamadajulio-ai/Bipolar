"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

type Phase = "inhale" | "hold" | "exhale" | "holdAfter";

interface BreathingCircleProps {
  inhale: number;
  hold: number;
  exhale: number;
  holdAfter: number;
  isActive: boolean;
  onCycleComplete?: () => void;
}

const phaseLabels: Record<Phase, string> = {
  inhale: "Inspire",
  hold: "Segure",
  exhale: "Expire",
  holdAfter: "Segure",
};

const phaseColors: Record<Phase, string> = {
  inhale: "var(--color-primary, #527a6e)",
  hold: "var(--color-info, #3b82f6)",
  exhale: "var(--color-success, #22c55e)",
  holdAfter: "var(--color-info, #3b82f6)",
};

export function BreathingCircle({
  inhale,
  hold,
  exhale,
  holdAfter,
  isActive,
  onCycleComplete,
}: BreathingCircleProps) {
  const [phase, setPhase] = useState<Phase>("inhale");
  const [timeLeft, setTimeLeft] = useState(inhale);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCycleCompleteRef = useRef(onCycleComplete);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    onCycleCompleteRef.current = onCycleComplete;
  }, [onCycleComplete]);

  const getNextPhase = useCallback(
    (current: Phase): { next: Phase; duration: number; cycleCompleted: boolean } => {
      switch (current) {
        case "inhale":
          if (hold > 0) return { next: "hold", duration: hold, cycleCompleted: false };
          return { next: "exhale", duration: exhale, cycleCompleted: false };
        case "hold":
          return { next: "exhale", duration: exhale, cycleCompleted: false };
        case "exhale":
          if (holdAfter > 0) return { next: "holdAfter", duration: holdAfter, cycleCompleted: false };
          return { next: "inhale", duration: inhale, cycleCompleted: true };
        case "holdAfter":
          return { next: "inhale", duration: inhale, cycleCompleted: true };
      }
    },
    [inhale, hold, exhale, holdAfter],
  );

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setPhase((currentPhase) => {
            const { next, duration, cycleCompleted } = getNextPhase(currentPhase);
            if (cycleCompleted) {
              onCycleCompleteRef.current?.();
            }
            setTimeout(() => setTimeLeft(duration), 0);
            return next;
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, getNextPhase]);

  // Reset when becoming inactive — setState is intentional here to sync state with external control
  useEffect(() => {
    if (!isActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhase("inhale");
      setTimeLeft(inhale);
    }
  }, [isActive, inhale]);

  // Calculate scale based on phase
  const getScale = () => {
    if (!isActive) return 0.6;
    switch (phase) {
      case "inhale":
        return 1;
      case "hold":
        return 1;
      case "exhale":
        return 0.6;
      case "holdAfter":
        return 0.6;
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: "50%",
            backgroundColor: phaseColors[phase],
            opacity: 0.2,
            transform: `scale(${getScale()})`,
            transition: prefersReducedMotion ? "none" : `transform ${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s ease-in-out`,
            position: "absolute",
          }}
        />
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: "50%",
            backgroundColor: phaseColors[phase],
            opacity: 0.4,
            transform: `scale(${getScale()})`,
            transition: prefersReducedMotion ? "none" : `transform ${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s ease-in-out`,
            position: "absolute",
          }}
        />
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            backgroundColor: phaseColors[phase],
            opacity: 0.8,
            transform: `scale(${getScale()})`,
            transition: prefersReducedMotion ? "none" : `transform ${phase === "inhale" ? inhale : phase === "exhale" ? exhale : 0.3}s ease-in-out`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "absolute",
          }}
        >
          <span className="text-white font-bold text-lg">{timeLeft}</span>
        </div>
      </div>
      <p className="text-lg font-semibold text-foreground">
        {isActive ? phaseLabels[phase] : "Pronto"}
      </p>
    </div>
  );
}
