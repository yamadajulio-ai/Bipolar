"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/Card";

type Task = "menu" | "reaction" | "digits" | "results";

interface TaskResult {
  reactionTimeMs: number | null;
  digitSpan: number | null;
  timestamp: string;
}

export default function CognitivoPage() {
  const [task, setTask] = useState<Task>("menu");
  const [result, setResult] = useState<TaskResult>({
    reactionTimeMs: null,
    digitSpan: null,
    timestamp: new Date().toISOString(),
  });

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Microtarefas Cognitivas</h1>
      <p className="mb-6 text-sm text-muted">
        Testes rápidos para acompanhar velocidade de processamento e memória de trabalho.
      </p>

      {task === "menu" && (
        <div className="space-y-3">
          <button
            type="button"
            className="w-full text-left cursor-pointer rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-primary/50 transition-colors"
            onClick={() => setTask("reaction")}
          >
            <h2 className="text-sm font-semibold">Tempo de Reação</h2>
            <p className="mt-1 text-xs text-muted">
              Toque quando a tela mudar de cor. Mede velocidade de processamento (~30s).
            </p>
          </button>
          <button
            type="button"
            className="w-full text-left cursor-pointer rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-primary/50 transition-colors"
            onClick={() => setTask("digits")}
          >
            <h2 className="text-sm font-semibold">Span de Dígitos</h2>
            <p className="mt-1 text-xs text-muted">
              Memorize e repita sequências numéricas. Mede memória de trabalho (~1min).
            </p>
          </button>
          {(result.reactionTimeMs !== null || result.digitSpan !== null) && (
            <button
              onClick={() => setTask("results")}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Ver resultados
            </button>
          )}
          <p className="text-center text-[10px] text-muted">
            Baseado em paradigmas de neuropsicologia cognitiva. Alterações cognitivas são comuns
            em episódios bipolares (Bora et al., 2009). Resultados são indicativos — não diagnósticos.
          </p>
        </div>
      )}

      {task === "reaction" && (
        <ReactionTimeTask
          onComplete={(ms) => {
            setResult((r) => ({ ...r, reactionTimeMs: ms }));
            setTask("results");
          }}
          onBack={() => setTask("menu")}
        />
      )}

      {task === "digits" && (
        <DigitSpanTask
          onComplete={(span) => {
            setResult((r) => ({ ...r, digitSpan: span }));
            setTask("results");
          }}
          onBack={() => setTask("menu")}
        />
      )}

      {task === "results" && (
        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold">Seus Resultados</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-muted">Tempo de Reação</div>
                <div className={`text-2xl font-bold ${
                  result.reactionTimeMs !== null
                    ? result.reactionTimeMs < 300 ? "text-green-400"
                      : result.reactionTimeMs < 500 ? "text-amber-400"
                      : "text-red-400"
                    : "text-muted"
                }`}>
                  {result.reactionTimeMs !== null ? `${result.reactionTimeMs}ms` : "—"}
                </div>
                <div className="text-[10px] text-muted">
                  {result.reactionTimeMs !== null
                    ? result.reactionTimeMs < 300 ? "Rápido"
                      : result.reactionTimeMs < 500 ? "Normal"
                      : "Lento"
                    : "Não testado"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Span de Dígitos</div>
                <div className={`text-2xl font-bold ${
                  result.digitSpan !== null
                    ? result.digitSpan >= 7 ? "text-green-400"
                      : result.digitSpan >= 5 ? "text-amber-400"
                      : "text-red-400"
                    : "text-muted"
                }`}>
                  {result.digitSpan !== null ? result.digitSpan : "—"}
                </div>
                <div className="text-[10px] text-muted">
                  {result.digitSpan !== null
                    ? result.digitSpan >= 7 ? "Acima da média"
                      : result.digitSpan >= 5 ? "Normal"
                      : "Abaixo da média"
                    : "Não testado"}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-1 text-xs font-semibold text-muted">Referências</h3>
            <ul className="space-y-1 text-xs text-muted">
              <li>Tempo de reação: adultos saudáveis ~250-350ms (Deary et al.)</li>
              <li>Digit span: média 7±2 (Miller, 1956). Bipolar em eutimia: ~6 (Bora et al., 2009)</li>
              <li>Lentificação cognitiva é um dos sintomas mais relatados em episódios depressivos</li>
            </ul>
          </Card>

          <div className="flex gap-2">
            <button
              onClick={() => setTask("menu")}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                setResult({ reactionTimeMs: null, digitSpan: null, timestamp: new Date().toISOString() });
                setTask("menu");
              }}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              Refazer testes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reaction Time Task ─────────────────────────────────────

function ReactionTimeTask({ onComplete, onBack }: { onComplete: (ms: number) => void; onBack: () => void }) {
  const [phase, setPhase] = useState<"wait" | "ready" | "go" | "tooEarly">("wait");
  const [trials, setTrials] = useState<number[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  const TOTAL_TRIALS = 5;

  const startTrial = useCallback(() => {
    setPhase("ready");
    // Random delay 2-5 seconds
    const delay = 2000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => {
      startTimeRef.current = performance.now();
      lockedRef.current = false;
      setPhase("go");
    }, delay);
  }, []);

  useEffect(() => {
    if (phase === "wait") {
      const t = setTimeout(startTrial, 1000);
      return () => clearTimeout(t);
    }
  }, [phase, startTrial]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    };
  }, []);

  function handleTap() {
    if (phase === "ready") {
      // Tapped too early
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("tooEarly");
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
      phaseTimeoutRef.current = setTimeout(() => setPhase("wait"), 1500);
      return;
    }

    if (phase === "go") {
      if (lockedRef.current) return;
      lockedRef.current = true;

      const reactionTime = Math.round(performance.now() - startTimeRef.current);
      setTrials((prev) => {
        const next = [...prev, reactionTime];
        if (next.length >= TOTAL_TRIALS) {
          const sorted = [...next].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          onComplete(median);
        } else {
          setPhase("wait");
          lockedRef.current = false;
        }
        return next;
      });
    }
  }

  const trialNum = trials.length + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted">
          ← Voltar
        </button>
        <span className="text-xs text-muted">
          Tentativa {Math.min(trialNum, TOTAL_TRIALS)}/{TOTAL_TRIALS}
        </span>
      </div>

      <button
        type="button"
        onPointerDown={handleTap}
        aria-label="Área do teste de tempo de reação. Toque quando mudar para verde."
        className={`flex h-64 w-full cursor-pointer items-center justify-center rounded-xl text-center transition-colors ${
          phase === "ready"
            ? "bg-red-900/50"
            : phase === "go"
              ? "bg-green-600"
              : phase === "tooEarly"
                ? "bg-amber-900/50"
                : "bg-gray-800"
        }`}
      >
        {phase === "wait" && (
          <p className="text-sm text-muted">Aguarde...</p>
        )}
        {phase === "ready" && (
          <p className="text-lg font-bold text-red-300">Espere a cor verde...</p>
        )}
        {phase === "go" && (
          <p className="text-2xl font-bold text-white">TOQUE AGORA!</p>
        )}
        {phase === "tooEarly" && (
          <p className="text-sm text-amber-300">Cedo demais! Espere o verde.</p>
        )}
      </button>

      {trials.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {trials.map((t, i) => (
            <span key={i} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-muted">
              {t}ms
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Digit Span Task ─────────────────────────────────────────

function DigitSpanTask({ onComplete, onBack }: { onComplete: (span: number) => void; onBack: () => void }) {
  const [phase, setPhase] = useState<"showing" | "input" | "feedback">("showing");
  const [sequenceLength, setSequenceLength] = useState(3);
  const [currentSequence, setCurrentSequence] = useState<number[]>([]);
  const [showingIndex, setShowingIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [maxSpan, setMaxSpan] = useState(0);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);
    };
  }, []);

  // Generate and show sequence
  useEffect(() => {
    if (phase === "showing") {
      const seq = Array.from({ length: sequenceLength }, () => Math.floor(Math.random() * 10));
      setCurrentSequence(seq);
      setShowingIndex(0);
      setUserInput("");
      setCorrect(null);
    }
  }, [phase, sequenceLength]);

  // Animate showing digits
  useEffect(() => {
    if (phase !== "showing" || currentSequence.length === 0) return;

    if (showingIndex < currentSequence.length) {
      const t = setTimeout(() => setShowingIndex(showingIndex + 1), 1000);
      return () => clearTimeout(t);
    } else {
      // Done showing, switch to input
      const t = setTimeout(() => setPhase("input"), 500);
      return () => clearTimeout(t);
    }
  }, [phase, showingIndex, currentSequence]);

  function handleSubmit() {
    const userDigits = userInput.split("").map(Number);
    const isCorrect = userDigits.length === currentSequence.length &&
      userDigits.every((d, i) => d === currentSequence[i]);

    setCorrect(isCorrect);
    setPhase("feedback");

    if (submitTimeoutRef.current) clearTimeout(submitTimeoutRef.current);

    if (isCorrect) {
      setMaxSpan(Math.max(maxSpan, sequenceLength));
      setConsecutiveErrors(0);
      // Next round: increase length
      submitTimeoutRef.current = setTimeout(() => {
        setSequenceLength(sequenceLength + 1);
        setPhase("showing");
      }, 1200);
    } else {
      const newErrors = consecutiveErrors + 1;
      setConsecutiveErrors(newErrors);
      if (newErrors >= 2) {
        // Game over after 2 consecutive errors at same length
        submitTimeoutRef.current = setTimeout(() => onComplete(maxSpan || sequenceLength - 1), 1500);
      } else {
        // Retry same length
        submitTimeoutRef.current = setTimeout(() => setPhase("showing"), 1200);
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted">
          ← Voltar
        </button>
        <span className="text-xs text-muted">
          Nível: {sequenceLength} dígitos · Recorde: {maxSpan}
        </span>
      </div>

      {/* Display area */}
      <div className="flex h-48 items-center justify-center rounded-xl bg-gray-800">
        {phase === "showing" && showingIndex < currentSequence.length && (
          <span className="text-6xl font-bold text-white tabular-nums">
            {currentSequence[showingIndex]}
          </span>
        )}
        {phase === "showing" && showingIndex >= currentSequence.length && (
          <span className="text-sm text-muted">Preparando...</span>
        )}
        {phase === "input" && (
          <div className="text-center">
            <p className="mb-3 text-sm text-muted">Digite a sequência:</p>
            <input
              type="text"
              inputMode="numeric"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value.replace(/\D/g, ""))}
              maxLength={sequenceLength}
              autoFocus
              className="mx-auto block w-48 rounded-lg border border-border bg-surface px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter" && userInput.length === sequenceLength) {
                  handleSubmit();
                }
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={userInput.length !== sequenceLength}
              className="mt-3 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        )}
        {phase === "feedback" && (
          <div className="text-center">
            <span className={`text-3xl ${correct ? "text-green-400" : "text-red-400"}`}>
              {correct ? "Correto!" : "Errado"}
            </span>
            {!correct && (
              <p className="mt-2 text-sm text-muted">
                Sequência: {currentSequence.join("")}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-muted">
        Digit Span Forward — teste padrão de memória de trabalho (Wechsler, 1997).
        Adultos saudáveis: 7±2. Não substitui avaliação neuropsicológica.
      </p>
    </div>
  );
}
