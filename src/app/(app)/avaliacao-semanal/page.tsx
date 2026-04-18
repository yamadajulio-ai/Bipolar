"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { SafetyNudge } from "@/components/insights/SafetyNudge";
import { LoadingState } from "@/components/ui/StatusStates";
import { track } from "@/lib/telemetry";
import {
  ASRM_ITEMS,
  PHQ9_ITEMS,
  PHQ9_FREQUENCY_OPTIONS,
  FAST_SHORT_ITEMS,
} from "@/lib/constants";

type Step = "asrm" | "phq9" | "fast" | "review";

const TZ = "America/Sao_Paulo";

function getWeekEndDate(): string {
  const now = new Date();
  // Get today in local timezone
  const todayStr = now.toLocaleDateString("sv-SE", { timeZone: TZ });
  const [y, m, d] = todayStr.split("-").map(Number);
  // Use midday UTC to avoid DST edge cases
  const local = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const day = local.getUTCDay();
  const diff = day === 0 ? 0 : 7 - day;
  local.setUTCDate(local.getUTCDate() + diff);
  const y2 = local.getUTCFullYear();
  const m2 = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(local.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

interface ExistingAssessment {
  asrmScores: string | null;
  phq9Scores: string | null;
  fastScores: string | null;
  exerciseDaysPerWeek: number | null;
  notes: string | null;
  date: string;
  createdAt: string;
}

export default function AvaliacaoSemanalPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("asrm");
  const [asrmScores, setAsrmScores] = useState<number[]>(Array(5).fill(-1));
  const [phq9Scores, setPhq9Scores] = useState<number[]>(Array(9).fill(-1));
  const [fastScores, setFastScores] = useState<Record<string, number>>({});
  const [exerciseDays, setExerciseDays] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stepError, setStepError] = useState("");
  const [safetyFlag, setSafetyFlag] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existing, setExisting] = useState<ExistingAssessment | null>(null);
  const [showExistingWarning, setShowExistingWarning] = useState(false);
  const [loading, setLoading] = useState(true);

  const weekEnd = getWeekEndDate();
  const DRAFT_KEY = `assessment-draft-${weekEnd}`;
  const draftRestored = useRef(false);
  const trackedStart = useRef(false);

  // Track page open
  useEffect(() => {
    if (!loading && !trackedStart.current) {
      trackedStart.current = true;
      track({ name: "assessment_start" });
    }
  }, [loading]);

  // Track abandon on page unload
  useEffect(() => {
    function handleBeforeUnload() {
      if (!success && step !== "review") {
        track({ name: "assessment_dropoff", step });
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step, success]);

  // Stepper metadata
  const stepLabels: Record<Step, { label: string; num: number; questions: number }> = {
    asrm: { label: "ASRM (Mania)", num: 1, questions: 5 },
    phq9: { label: "PHQ-9 (Depressão)", num: 2, questions: 9 },
    fast: { label: "FAST (Funcionamento)", num: 3, questions: FAST_SHORT_ITEMS.length },
    review: { label: "Revisão", num: 4, questions: 0 },
  };
  const currentStepMeta = stepLabels[step];
  const totalQuestions = 5 + 9 + FAST_SHORT_ITEMS.length;
  const answeredQuestions =
    asrmScores.filter((s) => s !== -1).length +
    phq9Scores.filter((s) => s !== -1).length +
    Object.keys(fastScores).length;
  const progressPct = Math.round((answeredQuestions / totalQuestions) * 100);

  // Question index within current step
  const currentStepAnswered =
    step === "asrm" ? asrmScores.filter((s) => s !== -1).length :
    step === "phq9" ? phq9Scores.filter((s) => s !== -1).length :
    step === "fast" ? Object.keys(fastScores).length : 0;

  // Check if assessment already exists for current week
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch("/api/avaliacao-semanal?limit=1");
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const latest = data[0];
          if (latest.date === weekEnd) {
            setExisting(latest);
            setShowExistingWarning(true);
          }
        }
      } catch {
        // silently continue — not critical
      } finally {
        setLoading(false);
      }
    }
    checkExisting();
  }, [weekEnd]);

  // Restore draft after loading completes (only if no server data)
  useEffect(() => {
    if (loading || draftRestored.current) return;
    // Only restore draft if there's no existing assessment that triggered the warning
    if (showExistingWarning) { draftRestored.current = true; return; }
    draftRestored.current = true;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (Array.isArray(draft.asrmScores) && draft.asrmScores.length === 5) setAsrmScores(draft.asrmScores);
      // PHQ-9 scores are never persisted in drafts (contains sensitive suicidal ideation data)
      if (draft.fastScores && typeof draft.fastScores === "object" && !Array.isArray(draft.fastScores)) setFastScores(draft.fastScores);
      if (typeof draft.exerciseDays === "number" && draft.exerciseDays >= 0 && draft.exerciseDays <= 7) setExerciseDays(draft.exerciseDays);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (draft.step && ["asrm", "phq9", "fast", "review"].includes(draft.step)) setStep(draft.step);
    } catch { /* ignore corrupt draft */ }
  }, [loading, showExistingWarning, DRAFT_KEY]);

  // Save draft on every change (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ asrmScores, fastScores, exerciseDays, notes, step }),
        );
      } catch { /* storage full — ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [asrmScores, fastScores, exerciseDays, notes, step, DRAFT_KEY]);

  function prefillFromExisting(assessment: ExistingAssessment) {
    try {
      if (assessment.asrmScores) {
        const parsed = JSON.parse(assessment.asrmScores);
        if (Array.isArray(parsed)) setAsrmScores(parsed);
      }
      if (assessment.phq9Scores) {
        const parsed = JSON.parse(assessment.phq9Scores);
        if (Array.isArray(parsed)) setPhq9Scores(parsed);
      }
      if (assessment.fastScores) {
        const parsed = typeof assessment.fastScores === "string"
          ? JSON.parse(assessment.fastScores)
          : assessment.fastScores;
        if (parsed && typeof parsed === "object") setFastScores(parsed);
      }
      if (typeof assessment.exerciseDaysPerWeek === "number") setExerciseDays(assessment.exerciseDaysPerWeek);
      if (assessment.notes) setNotes(assessment.notes);
    } catch {
      // Corrupted stored data — start fresh
    }
    setShowExistingWarning(false);
  }

  function startFresh() {
    setShowExistingWarning(false);
  }

  const setAsrm = useCallback((idx: number, val: number) => {
    setAsrmScores((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }, []);

  const setPhq9 = useCallback((idx: number, val: number) => {
    setPhq9Scores((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    // PHQ-9 item 9 (index 8): immediate safety flag
    if (idx === 8 && val >= 1) {
      setSafetyFlag(true);
    }
  }, []);

  const setFast = useCallback((key: string, val: number) => {
    setFastScores((prev) => ({ ...prev, [key]: val }));
  }, []);

  // PHQ-9 item 9 safety check
  const phq9Item9 = phq9Scores[8];
  const showSafetyNudge = phq9Item9 >= 1;

  const asrmComplete = asrmScores.every((s) => s >= 0);
  const phq9Complete = phq9Scores.every((s) => s >= 0);
  const fastComplete = FAST_SHORT_ITEMS.every((item) => fastScores[item.key] !== undefined);

  const asrmTotal = asrmScores.reduce((a, b) => a + Math.max(0, b), 0);
  const phq9Total = phq9Scores.reduce((a, b) => a + Math.max(0, b), 0);
  const fastAvg =
    fastComplete
      ? Math.round(
          (Object.values(fastScores).reduce((a, b) => a + b, 0) /
            FAST_SHORT_ITEMS.length) *
            10,
        ) / 10
      : null;

  async function handleSubmit() {
    setSaving(true);
    setError("");

    // Prevent submit with unanswered sentinel -1 values
    if (asrmScores.some((s) => s === -1)) {
      setError("Responda todas as perguntas do ASRM antes de enviar.");
      setSaving(false);
      return;
    }
    if (phq9Scores.some((s) => s === -1)) {
      setError("Responda todas as perguntas do PHQ-9 antes de enviar.");
      setSaving(false);
      return;
    }
    if (!FAST_SHORT_ITEMS.every((item) => fastScores[item.key] !== undefined)) {
      setError("Responda todas as perguntas de Funcionamento antes de enviar.");
      setSaving(false);
      return;
    }

    try {
      const body: Record<string, unknown> = {
        date: weekEnd,
      };
      if (asrmComplete) body.asrmScores = asrmScores;
      if (phq9Complete) body.phq9Scores = phq9Scores;
      if (fastComplete) {
        body.fastScores = fastScores;
      }
      if (exerciseDays !== null) body.exerciseDaysPerWeek = exerciseDays;
      if (notes.trim()) body.notes = notes.trim();

      const res = await fetch("/api/avaliacao-semanal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erro ao salvar.");
        return;
      }

      const data = await res.json();
      if (data.safetyFlag) setSafetyFlag(true);
      // Clear draft on successful submit
      try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
      track({ name: "assessment_complete", asrmTotal, phq9Total });
      setSuccess(true);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="py-8 text-center">
          <p className="text-lg font-semibold text-foreground">
            Avaliação semanal salva!
          </p>
          {asrmTotal >= 6 && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Sinais de humor elevado detectados (pontuação {asrmTotal}) — pode ser útil compartilhar esse resultado com seu profissional de saúde.
            </p>
          )}
          {phq9Total >= 10 && (
            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              Sinais de humor baixo detectados (pontuação {phq9Total}) — considere compartilhar esse resultado na sua próxima consulta.
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Estes resultados são indicadores de rastreio, não um diagnóstico.
            Compartilhe com seu profissional de saúde para avaliação completa.
          </p>
          <button
            onClick={() => router.push("/insights")}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Ver Insights
          </button>
        </Card>
        {safetyFlag && <SafetyNudge phq9Item9={phq9Item9} />}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg">
        <LoadingState message="Carregando avaliação..." />
      </div>
    );
  }

  if (showExistingWarning && existing) {
    const createdDate = new Date(existing.createdAt);
    const formattedDate = createdDate.toLocaleDateString("pt-BR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-2xl font-bold">Avaliação Semanal</h1>
        <Alert variant="warning">
          <p className="font-medium">Você já preencheu esta semana</p>
          <p className="mt-1 text-sm">
            Existe uma avaliação salva em {formattedDate}. Se continuar, as respostas anteriores serão substituídas.
          </p>
        </Alert>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => prefillFromExisting(existing)}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Editar respostas anteriores
          </button>
          <button
            onClick={startFresh}
            className="rounded-lg border border-border px-6 py-3 text-sm font-medium text-muted hover:border-primary/50"
          >
            Começar do zero
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-muted hover:text-foreground"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-bold">Avaliação Semanal</h1>
      <p className="mb-4 text-sm text-muted">
        Três questionários rápidos para acompanhar como você está: sinais de mania, sinais de depressão e como está funcionando no dia a dia.
      </p>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Enhanced stepper */}
      <div className="mb-6 space-y-2">
        {/* Step label + estimated time */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            Etapa {currentStepMeta.num} de 4: {currentStepMeta.label}
          </p>
          {currentStepMeta.num === 1 && (
            <span className="text-xs text-muted">~5 minutos</span>
          )}
        </div>

        {/* Question count within step */}
        {currentStepMeta.questions > 0 && (
          <p className="text-xs text-muted">
            Pergunta {Math.min(currentStepAnswered + 1, currentStepMeta.questions)} de {currentStepMeta.questions}
          </p>
        )}

        {/* Overall progress bar */}
        <div
          className="relative h-2 w-full rounded-full bg-border overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progresso: ${progressPct}% das perguntas respondidas`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Step dots */}
        {(() => {
          const allSteps: Step[] = ["asrm", "phq9", "fast", "review"];
          const currentIdx = allSteps.indexOf(step);
          return (
            <div className="flex gap-1" role="list" aria-label="Etapas da avaliação">
              {allSteps.map((s, i) => (
                <div
                  key={s}
                  role="listitem"
                  aria-current={i === currentIdx ? "step" : undefined}
                  aria-label={`Etapa ${i + 1}: ${stepLabels[s].label}${i < currentIdx ? " (concluída)" : i === currentIdx ? " (atual)" : ""}`}
                  className={`h-1 flex-1 rounded-full ${
                    i === currentIdx ? "bg-primary" : i < currentIdx ? "bg-primary/40" : "bg-border"
                  }`}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* ASRM Step */}
      {step === "asrm" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Sinais de Mania
          </h2>
          <p className="text-sm text-muted mb-1">
            Avalia se você pode estar com humor elevado, acelerado ou irritável — sinais que podem indicar uma fase de mania ou hipomania.
          </p>
          <p className="text-xs text-muted">
            Sobre a última semana: qual afirmação melhor descreve você?
          </p>
          {ASRM_ITEMS.map((item, idx) => (
            <Card key={item.id}>
              <p className="mb-2 text-sm font-medium text-foreground">
                {item.question}
              </p>
              <div className="space-y-1.5">
                {item.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => setAsrm(idx, optIdx)}
                    aria-pressed={asrmScores[idx] === optIdx}
                    aria-label={`Opção ${optIdx + 1}: ${opt}`}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors min-h-[44px] ${
                      asrmScores[idx] === optIdx
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Card>
          ))}
          {stepError && step === "asrm" && (
            <p className="text-sm text-red-600 dark:text-red-400">{stepError}</p>
          )}
          <div className="flex justify-between">
            <div />
            <button
              onClick={() => {
                if (asrmScores.some((s) => s === -1)) {
                  setStepError("Responda todas as 5 perguntas antes de avançar.");
                  return;
                }
                setStepError("");
                track({ name: "assessment_step", step: "phq9" });
                setStep("phq9");
              }}
              className="rounded-lg bg-primary px-6 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Próximo: Depressão
            </button>
          </div>
        </div>
      )}

      {/* PHQ-9 Step */}
      {step === "phq9" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Sinais de Depressão
          </h2>
          <p className="text-sm text-muted mb-1">
            Avalia sintomas de depressão como tristeza, perda de interesse, cansaço e dificuldade de concentração. É o questionário mais usado no mundo para acompanhar depressão.
          </p>
          <p className="text-xs text-muted">
            Nas últimas 2 semanas, com que frequência você foi incomodado(a) por:
          </p>
          {PHQ9_ITEMS.map((question, idx) => (
            <Card key={idx}>
              <p className="mb-2 text-sm font-medium text-foreground">
                {idx + 1}. {question}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {PHQ9_FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPhq9(idx, opt.value)}
                    aria-pressed={phq9Scores[idx] === opt.value}
                    aria-label={`${opt.label}${"hint" in opt && opt.hint ? ` (${opt.hint})` : ""}`}
                    className={`rounded-lg border px-2 py-2 text-xs transition-colors min-h-[44px] ${
                      phq9Scores[idx] === opt.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                    {"hint" in opt && opt.hint && (
                      <span className="block text-[11px] opacity-60 mt-0.5">{opt.hint}</span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          ))}

          {/* Safety nudge inline after item 9 */}
          {showSafetyNudge && <SafetyNudge phq9Item9={phq9Item9} compact />}

          {stepError && step === "phq9" && (
            <p className="text-sm text-red-600 dark:text-red-400">{stepError}</p>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => { setStepError(""); setStep("asrm"); }}
              className="rounded-lg border border-border px-4 py-2 min-h-[44px] text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                if (phq9Scores.some((s) => s === -1)) {
                  setStepError("Responda todas as 9 perguntas antes de avançar.");
                  return;
                }
                setStepError("");
                track({ name: "assessment_step", step: "fast" });
                setStep("fast");
              }}
              className="rounded-lg bg-primary px-6 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Próximo: Funcionamento
            </button>
          </div>
        </div>
      )}

      {/* FAST Step */}
      {step === "fast" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Funcionamento no Dia a Dia
          </h2>
          <p className="text-sm text-muted mb-1">
            Avalia como o transtorno está impactando sua vida prática: trabalho, relações, autocuidado e organização.
          </p>
          <p className="text-xs text-muted">
            Na última semana, como foi seu desempenho nessas áreas?
          </p>
          {FAST_SHORT_ITEMS.map((item) => (
            <Card key={item.key}>
              <p className="mb-2 text-sm font-medium text-foreground">
                {item.label}
              </p>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFast(item.key, val)}
                    aria-pressed={fastScores[item.key] === val}
                    aria-label={`${item.label}: ${val} de 5 (${val === 1 ? "Muito difícil" : val === 5 ? "Sem dificuldade" : `Nível ${val}`})`}
                    className={`flex-1 rounded-lg border px-1 py-2 text-center text-xs transition-colors min-h-[44px] ${
                      fastScores[item.key] === val
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>Muito difícil</span>
                <span>Sem dificuldade</span>
              </div>
            </Card>
          ))}
          {stepError && step === "fast" && (
            <p className="text-sm text-red-600 dark:text-red-400">{stepError}</p>
          )}
          <div className="flex justify-between">
            <button
              onClick={() => { setStepError(""); setStep("phq9"); }}
              className="rounded-lg border border-border px-4 py-2 min-h-[44px] text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={() => {
                if (!FAST_SHORT_ITEMS.every((item) => fastScores[item.key] !== undefined)) {
                  setStepError("Responda todas as perguntas de funcionamento antes de avançar.");
                  return;
                }
                setStepError("");
                track({ name: "assessment_step", step: "review" });
                setStep("review");
              }}
              className="rounded-lg bg-primary px-6 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {/* Review Step */}
      {step === "review" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Resumo</h2>

          <Card>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted">Mania</div>
                <div
                  className={`text-xl font-bold ${
                    asrmTotal >= 6 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {asrmTotal}
                  <span className="text-xs font-normal text-muted">/20</span>
                </div>
                {asrmTotal >= 6 ? (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">Acima do ponto de atenção — vale mencionar na consulta</div>
                ) : (
                  <div className="text-[11px] text-green-600 dark:text-green-400">Sem sinais significativos</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Depressão</div>
                <div
                  className={`text-xl font-bold ${
                    phq9Total >= 15
                      ? "text-red-600 dark:text-red-400"
                      : phq9Total >= 10
                        ? "text-amber-600 dark:text-amber-400"
                        : phq9Total >= 5
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {phq9Total}
                  <span className="text-xs font-normal text-muted">/27</span>
                </div>
                <div className="text-[11px] text-muted">
                  {phq9Total < 5
                    ? "Sem sinais significativos"
                    : phq9Total < 10
                      ? "Sintomas leves"
                      : phq9Total < 15
                        ? "Sintomas moderados"
                        : phq9Total < 20
                          ? "Sintomas importantes — converse com seu médico"
                          : "Sintomas severos — procure ajuda"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted">Dia a dia</div>
                <div className="text-xl font-bold text-foreground">
                  {fastAvg ?? "—"}
                  <span className="text-xs font-normal text-muted">/5</span>
                </div>
                <div className="text-[11px] text-muted">Funcionamento</div>
              </div>
            </div>
          </Card>

          <Card>
            <p className="mb-1 text-sm font-medium text-foreground">
              Nesta semana, em quantos dias você se exercitou por pelo menos 30 minutos?
            </p>
            <p className="mb-3 text-[11px] text-muted">
              Caminhada, dança, academia, yoga, esporte — qualquer atividade que deixe o corpo em movimento. Recomendação OMS: ≥5 dias/semana.
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setExerciseDays(n)}
                  aria-pressed={exerciseDays === n}
                  aria-label={`${n} ${n === 1 ? "dia" : "dias"} de exercício`}
                  className={`rounded-lg border px-2 py-2 min-h-[44px] text-sm font-medium transition-colors ${
                    exerciseDays === n
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-surface text-muted hover:border-primary/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {exerciseDays !== null && (
              <p className={`mt-2 text-[11px] ${exerciseDays >= 5 ? "text-success-fg" : exerciseDays >= 3 ? "text-muted" : "text-muted"}`}>
                {exerciseDays >= 5
                  ? "Dentro da recomendação da OMS — ótimo para estabilidade do humor."
                  : exerciseDays >= 3
                    ? "Bom começo — atividade regular ajuda a estabilizar humor e sono."
                    : exerciseDays === 0
                      ? "Sem pressão — em fases depressivas o corpo realmente não coopera. Comece pequeno quando puder."
                      : "Pouco movimento esta semana — qualquer quantidade ajuda, mesmo 10 minutos contam."}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted italic">
              Opcional. Pular é totalmente aceitável.
            </p>
          </Card>

          <Card>
            <label className="block text-sm font-medium text-foreground mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={280}
              rows={2}
              className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-control-border-focus focus-visible:outline-none"
              placeholder="Algo relevante sobre esta semana..."
            />
          </Card>

          {showSafetyNudge && <SafetyNudge phq9Item9={phq9Item9} />}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("fast")}
              className="rounded-lg border border-border px-4 py-2 min-h-[44px] text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-2 min-h-[44px] text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar avaliação"}
            </button>
          </div>

          <p className="text-center text-[11px] text-muted">
            Questionários validados internacionalmente: mania (ASRM, Altman), depressão (PHQ-9, Kroenke),
            funcionamento (inspirado no FAST, Vieta). Estes são instrumentos de rastreio — os resultados
            não constituem diagnóstico médico. Compartilhe com seu profissional de saúde.
          </p>
        </div>
      )}
    </div>
  );
}
