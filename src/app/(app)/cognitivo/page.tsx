"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/Card";

type Task = "menu" | "reaction" | "digits" | "results";

interface TaskResult {
  reactionTimeMs: number | null;
  digitSpan: number | null;
  timestamp: string;
}

interface HistoryEntry {
  id: string;
  reactionTimeMs: number | null;
  digitSpan: number | null;
  createdAt: string;
}

export default function CognitivoPage() {
  const [task, setTask] = useState<Task>("menu");
  const [result, setResult] = useState<TaskResult>({
    reactionTimeMs: null,
    digitSpan: null,
    timestamp: new Date().toISOString(),
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch("/api/cognitivo?days=90")
      .then((r) => (r.ok ? r.json() : []))
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, []);

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
            className="w-full text-left cursor-pointer rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary/50 transition-colors dark:border-border-strong"
            onClick={() => setTask("reaction")}
          >
            <h2 className="text-sm font-semibold">Tempo de Reação</h2>
            <p className="mt-1 text-xs text-muted">
              Toque quando a tela mudar de cor. Mede velocidade de processamento (~30s).
            </p>
          </button>
          <button
            type="button"
            className="w-full text-left cursor-pointer rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)] hover:border-primary/50 transition-colors dark:border-border-strong"
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

          {/* History */}
          {!loadingHistory && history.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold">Histórico recente</h2>
              <div className="space-y-2">
                {history.slice(0, 10).map((entry) => (
                  <HistoryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted">
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
        <ResultsScreen
          result={result}
          history={history}
          onBack={() => setTask("menu")}
          onReset={() => {
            setResult({ reactionTimeMs: null, digitSpan: null, timestamp: new Date().toISOString() });
            setTask("menu");
          }}
          onSaved={(entry) => setHistory((h) => [entry, ...h])}
        />
      )}
    </div>
  );
}

// ── History Card ───────────────────────────────────────────────

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const date = new Date(entry.createdAt);
  const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const reactionInfo = entry.reactionTimeMs !== null ? getReactionLevel(entry.reactionTimeMs) : null;
  const digitInfo = entry.digitSpan !== null ? getDigitLevel(entry.digitSpan) : null;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2">
      <span className="text-xs text-muted">{dateStr}</span>
      <div className="flex gap-3">
        {reactionInfo && (
          <span className={`text-xs font-medium ${reactionInfo.color}`}>
            {reactionInfo.emoji} {entry.reactionTimeMs}ms
          </span>
        )}
        {digitInfo && (
          <span className={`text-xs font-medium ${digitInfo.color}`}>
            {digitInfo.emoji} Span {entry.digitSpan}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Trend Summary ──────────────────────────────────────────────

function TrendSummary({ history, currentResult }: { history: HistoryEntry[]; currentResult: TaskResult }) {
  const reactionHistory = history.filter((h) => h.reactionTimeMs !== null).slice(0, 5);
  const digitHistory = history.filter((h) => h.digitSpan !== null).slice(0, 5);

  if (reactionHistory.length < 2 && digitHistory.length < 2) return null;

  const reactionTrend = reactionHistory.length >= 2 && currentResult.reactionTimeMs !== null
    ? getTrend(reactionHistory.map((h) => h.reactionTimeMs!), currentResult.reactionTimeMs, true)
    : null;

  const digitTrend = digitHistory.length >= 2 && currentResult.digitSpan !== null
    ? getTrend(digitHistory.map((h) => h.digitSpan!), currentResult.digitSpan, false)
    : null;

  if (!reactionTrend && !digitTrend) return null;

  return (
    <Card>
      <h3 className="mb-1 text-sm font-semibold">Comparação com seus testes anteriores</h3>
      <div className="space-y-1">
        {reactionTrend && (
          <p className="text-xs text-muted">
            <strong>Tempo de Reação:</strong> {reactionTrend}
          </p>
        )}
        {digitTrend && (
          <p className="text-xs text-muted">
            <strong>Span de Dígitos:</strong> {digitTrend}
          </p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted italic">
        Comparação com sua mediana das últimas sessões. Variação normal entre sessões é esperada.
      </p>
    </Card>
  );
}

function getTrend(pastValues: number[], current: number, lowerIsBetter: boolean): string {
  const sorted = [...pastValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const diff = current - median;
  const pctChange = Math.round((Math.abs(diff) / median) * 100);

  if (pctChange < 10) return "Estável em relação às sessões anteriores.";

  if (lowerIsBetter) {
    return diff < 0
      ? `Melhorou ${pctChange}% em relação à sua mediana recente (${median}ms).`
      : `Aumentou ${pctChange}% em relação à sua mediana recente (${median}ms). Fadiga ou medicação podem influenciar.`;
  } else {
    return diff > 0
      ? `Melhorou ${pctChange}% em relação à sua mediana recente (${median}).`
      : `Reduziu ${pctChange}% em relação à sua mediana recente (${median}). Normal em dias de maior fadiga.`;
  }
}

// ── Results Screen ──────────────────────────────────────────

function getReactionLevel(ms: number): { label: string; color: string; emoji: string; detail: string } {
  if (ms < 250) return { label: "Excelente", color: "text-green-700 dark:text-green-500", emoji: "🟢", detail: "Sua velocidade de processamento está acima da média. Reflexos muito rápidos." };
  if (ms < 350) return { label: "Bom", color: "text-green-600 dark:text-green-400", emoji: "🟢", detail: "Dentro da faixa esperada para adultos saudáveis (250–350ms). Boa velocidade de processamento." };
  if (ms < 500) return { label: "Normal", color: "text-amber-600 dark:text-amber-400", emoji: "🟡", detail: "Ligeiramente acima da média, mas dentro do aceitável. Fadiga, sono ou medicação podem influenciar." };
  if (ms < 700) return { label: "Lento", color: "text-orange-600 dark:text-orange-400", emoji: "🟠", detail: "Acima do esperado. Pode indicar fadiga, efeito de medicação sedativa, ou lentificação cognitiva — comum em episódios depressivos." };
  return { label: "Muito lento", color: "text-red-600 dark:text-red-400", emoji: "🔴", detail: "Significativamente acima do esperado. Considere se está com fadiga intensa, efeito de medicação, ou em fase depressiva. Vale relatar ao profissional." };
}

function getDigitLevel(span: number): { label: string; color: string; emoji: string; detail: string } {
  if (span >= 9) return { label: "Excelente", color: "text-green-700 dark:text-green-500", emoji: "🟢", detail: "Memória de trabalho acima da média. Capacidade excelente de retenção de informações." };
  if (span >= 7) return { label: "Bom", color: "text-green-600 dark:text-green-400", emoji: "🟢", detail: "Dentro da média (7±2, Miller 1956). Memória de trabalho funcionando bem." };
  if (span >= 5) return { label: "Normal", color: "text-amber-600 dark:text-amber-400", emoji: "🟡", detail: "Ligeiramente abaixo da média geral, mas dentro do esperado para pessoas com transtorno bipolar em fase estável (~6, Bora et al. 2009)." };
  if (span >= 4) return { label: "Abaixo da média", color: "text-orange-600 dark:text-orange-400", emoji: "🟠", detail: "Abaixo do esperado. Pode estar relacionado a episódio atual, efeito de medicação, ou fadiga. Acompanhe a evolução." };
  return { label: "Reduzido", color: "text-red-600 dark:text-red-400", emoji: "🔴", detail: "Significativamente abaixo da média. Vários fatores podem influenciar (sono, medicação, fadiga, entre outros). Compartilhe este resultado com seu profissional de saúde." };
}

function GaugeBar({ value, min, max, zones }: { value: number; min: number; max: number; zones: { end: number; color: string }[] }) {
  const clamped = Math.max(min, Math.min(max, value));
  const pct = ((clamped - min) / (max - min)) * 100;

  return (
    <div className="relative mt-2 mb-1">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {zones.map((zone, i) => {
          const prev = i === 0 ? min : zones[i - 1].end;
          const width = ((zone.end - prev) / (max - min)) * 100;
          return <div key={i} className={`h-full ${zone.color}`} style={{ width: `${width}%` }} />;
        })}
      </div>
      <div
        className="absolute top-[-4px] h-5 w-1 rounded-full bg-foreground shadow-[var(--shadow-raised)]"
        style={{ left: `calc(${pct}% - 2px)` }}
        aria-label={`Seu resultado: ${value}`}
      />
    </div>
  );
}

function ResultsScreen({ result, history, onBack, onReset, onSaved }: { result: TaskResult; history: HistoryEntry[]; onBack: () => void; onReset: () => void; onSaved: (entry: HistoryEntry) => void }) {
  const [saved, setSaved] = useState(false);
  const saveAttempted = useRef(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const hasReaction = result.reactionTimeMs !== null;
  const hasDigits = result.digitSpan !== null;
  const reactionInfo = hasReaction ? getReactionLevel(result.reactionTimeMs!) : null;
  const digitInfo = hasDigits ? getDigitLevel(result.digitSpan!) : null;

  // Auto-save on mount
  useEffect(() => {
    if (saveAttempted.current) return;
    saveAttempted.current = true;

    fetch("/api/cognitivo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reactionTimeMs: result.reactionTimeMs,
        digitSpan: result.digitSpan,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setSaved(true);
          setSavedId(data.id);
          onSaved(data);
        }
      })
      .catch(() => {});
  }, [result, onSaved]);

  // Summary message
  let summaryMessage = "";
  if (hasReaction && hasDigits) {
    const bothGood = result.reactionTimeMs! < 350 && result.digitSpan! >= 7;
    const bothBad = result.reactionTimeMs! >= 500 && result.digitSpan! < 5;
    if (bothGood) {
      summaryMessage = "Bom desempenho geral! Tanto a velocidade de processamento quanto a memória de trabalho estão dentro ou acima da média.";
    } else if (bothBad) {
      summaryMessage = "Ambos os indicadores estão abaixo do esperado. Isso pode estar relacionado ao seu estado atual (humor, sono, medicação). Considere registrar como se sente hoje e acompanhar a evolução nos próximos dias.";
    } else {
      summaryMessage = "Resultados mistos — é normal ter variação entre diferentes funções cognitivas. Fatores como sono, humor e medicação influenciam cada área de forma diferente.";
    }
  } else if (hasReaction) {
    summaryMessage = "Teste de velocidade de processamento concluído. Faça também o Span de Dígitos para uma avaliação mais completa.";
  } else if (hasDigits) {
    summaryMessage = "Teste de memória de trabalho concluído. Faça também o Tempo de Reação para uma avaliação mais completa.";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Seus Resultados</h2>
        {saved && <span className="text-xs text-green-500">Salvo</span>}
      </div>

      {/* Reaction Time */}
      {hasReaction && reactionInfo && (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">Tempo de Reação</h3>
              <p className="mt-0.5 text-xs text-muted">Velocidade de processamento</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${reactionInfo.color}`}>
                {result.reactionTimeMs}ms
              </span>
              <div className={`text-xs font-medium ${reactionInfo.color}`}>
                {reactionInfo.emoji} {reactionInfo.label}
              </div>
            </div>
          </div>
          <GaugeBar
            value={result.reactionTimeMs!}
            min={150}
            max={800}
            zones={[
              { end: 250, color: "bg-green-500" },
              { end: 350, color: "bg-green-400" },
              { end: 500, color: "bg-amber-400" },
              { end: 700, color: "bg-orange-400" },
              { end: 800, color: "bg-red-400" },
            ]}
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span>150ms</span>
            <span>250</span>
            <span>350</span>
            <span>500</span>
            <span>700+</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{reactionInfo.detail}</p>
          <p className="mt-1 text-[11px] text-muted italic">
            Ref: adultos saudáveis 250–350ms (Deary et al., 2001)
          </p>
        </Card>
      )}

      {/* Digit Span */}
      {hasDigits && digitInfo && (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">Span de Dígitos</h3>
              <p className="mt-0.5 text-xs text-muted">Memória de trabalho</p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${digitInfo.color}`}>
                {result.digitSpan}
              </span>
              <div className={`text-xs font-medium ${digitInfo.color}`}>
                {digitInfo.emoji} {digitInfo.label}
              </div>
            </div>
          </div>
          <GaugeBar
            value={result.digitSpan!}
            min={2}
            max={11}
            zones={[
              { end: 4, color: "bg-red-400" },
              { end: 5, color: "bg-orange-400" },
              { end: 7, color: "bg-amber-400" },
              { end: 9, color: "bg-green-400" },
              { end: 11, color: "bg-green-500" },
            ]}
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span>2</span>
            <span>4</span>
            <span>5</span>
            <span>7</span>
            <span>9+</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{digitInfo.detail}</p>
          <p className="mt-1 text-[11px] text-muted italic">
            Ref: média 7±2 (Miller, 1956). Bipolar em fase estável: ~6 (Bora et al., 2009)
          </p>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Interpretação</h3>
        <p className="text-xs leading-relaxed text-muted">{summaryMessage}</p>
        <div className="mt-3 rounded-lg bg-surface-alt p-3">
          <h4 className="text-xs font-semibold mb-1">O que pode influenciar seus resultados:</h4>
          <ul className="space-y-0.5 text-[11px] text-muted">
            <li>• <strong>Sono:</strong> privação de sono reduz velocidade e memória</li>
            <li>• <strong>Humor:</strong> episódios depressivos causam lentificação cognitiva</li>
            <li>• <strong>Medicação:</strong> estabilizadores e antipsicóticos podem afetar tempo de reação</li>
            <li>• <strong>Hora do dia:</strong> o desempenho cognitivo varia ao longo do dia</li>
            <li>• <strong>Prática:</strong> refazer o teste regularmente ajuda a acompanhar tendências</li>
          </ul>
        </div>
      </Card>

      {/* Trend comparison — exclude the just-saved entry so current result isn't compared against itself */}
      <TrendSummary history={savedId ? history.filter((h) => h.id !== savedId) : history} currentResult={result} />

      {/* Suggestions */}
      <Card>
        <h3 className="mb-1 text-sm font-semibold">Dica</h3>
        <p className="text-xs leading-relaxed text-muted">
          Faça este teste periodicamente (1–2x por semana, sempre no mesmo horário) para acompanhar
          sua função cognitiva ao longo do tempo. Variações podem ajudar a identificar mudanças no
          seu estado de humor antes que se tornem evidentes.
        </p>
        <p className="mt-2 text-[11px] text-muted italic">
          Estes resultados são indicativos e não substituem avaliação neuropsicológica profissional.
        </p>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted"
        >
          Voltar
        </button>
        <button
          onClick={onReset}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Refazer testes
        </button>
      </div>
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
        className={`flex h-64 w-full cursor-pointer items-center justify-center rounded-[var(--radius-card)] text-center transition-colors ${
          phase === "ready"
            ? "bg-red-100 dark:bg-red-900/50"
            : phase === "go"
              ? "bg-green-100 dark:bg-green-600"
              : phase === "tooEarly"
                ? "bg-amber-100 dark:bg-amber-900/50"
                : "bg-gray-800 dark:bg-gray-900"
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
            <span key={i} className="rounded-full bg-gray-800 dark:bg-gray-900 px-2 py-0.5 text-xs text-muted">
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
      <div className="flex h-48 items-center justify-center rounded-[var(--radius-card)] bg-gray-800 dark:bg-gray-900">
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
            <span className={`text-3xl ${correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
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

      <p className="text-center text-[11px] text-muted">
        Digit Span Forward — teste padrão de memória de trabalho (Wechsler, 1997).
        Adultos saudáveis: 7±2. Não substitui avaliação neuropsicológica.
      </p>
    </div>
  );
}
