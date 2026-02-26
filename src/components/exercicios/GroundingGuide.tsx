"use client";

import { useState, useEffect, useRef } from "react";
import { ProgressSteps } from "./ProgressSteps";

interface GroundingStep {
  instruction: string;
  count?: number;
  sense?: string;
  duration?: number;
}

interface GroundingExercise {
  name: string;
  description: string;
  steps: readonly GroundingStep[];
}

interface GroundingGuideProps {
  exercise: GroundingExercise;
  onComplete?: (totalDurationSecs: number) => void;
}

export function GroundingGuide({ exercise, onComplete }: GroundingGuideProps) {
  const [currentStep, setCurrentStep] = useState(-1); // -1 = not started
  const [stepTimer, setStepTimer] = useState(0);
  const [completed, setCompleted] = useState(false);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isStarted = currentStep >= 0;
  const step = isStarted && currentStep < exercise.steps.length ? exercise.steps[currentStep] : null;

  // Timer for steps with duration
  const stepDuration = step?.duration;
  useEffect(() => {
    if (stepDuration && isStarted && !completed) {
      const initialDuration = stepDuration;
      // setState in effect is intentional — syncing timer with step changes
      let countdown = initialDuration;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepTimer(countdown);
      timerRef.current = setInterval(() => {
        countdown -= 1;
        if (countdown <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStepTimer(0);
        } else {
          setStepTimer(countdown);
        }
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [currentStep, isStarted, completed, stepDuration]);

  function handleStart() {
    startTimeRef.current = Date.now();
    setCurrentStep(0);
  }

  function handleNext() {
    if (timerRef.current) clearInterval(timerRef.current);
    const nextStep = currentStep + 1;
    if (nextStep >= exercise.steps.length) {
      setCompleted(true);
      const elapsed = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;
      onComplete?.(elapsed);
    } else {
      setCurrentStep(nextStep);
    }
  }

  function handleReset() {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrentStep(-1);
    setStepTimer(0);
    setCompleted(false);
    startTimeRef.current = null;
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl font-bold mb-2">{exercise.name}</h2>
      <p className="text-sm text-muted mb-6 text-center max-w-md">
        {exercise.description}
      </p>

      {!isStarted && !completed && (
        <button
          onClick={handleStart}
          className="rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
        >
          Iniciar exercicio
        </button>
      )}

      {isStarted && !completed && step && (
        <>
          <ProgressSteps current={currentStep} total={exercise.steps.length} />

          <p className="mt-2 text-xs text-muted">
            Passo {currentStep + 1} de {exercise.steps.length}
          </p>

          <div className="mt-6 rounded-lg border border-border bg-surface-alt p-6 text-center max-w-md">
            <p className="text-lg font-semibold text-foreground leading-relaxed">
              {step.instruction}
            </p>
            {step.duration && stepTimer > 0 && (
              <p className="mt-3 text-2xl font-bold text-primary">{stepTimer}s</p>
            )}
          </div>

          <button
            onClick={handleNext}
            className="mt-6 rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-primary-dark"
          >
            {currentStep < exercise.steps.length - 1 ? "Proximo" : "Concluir"}
          </button>
        </>
      )}

      {completed && (
        <div className="text-center">
          <div className="rounded-lg border border-success/30 bg-success/10 p-6 mb-4">
            <p className="text-lg font-semibold text-success">Exercicio concluido!</p>
            <p className="text-sm text-muted mt-1">
              Parabens por dedicar esse tempo ao seu bem-estar.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="rounded-lg border border-border bg-surface px-6 py-2 font-medium text-foreground hover:bg-surface-alt"
          >
            Fazer novamente
          </button>
        </div>
      )}
    </div>
  );
}
