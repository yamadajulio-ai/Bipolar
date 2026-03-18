"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { SafetyNudge } from "@/components/insights/SafetyNudge";
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

export default function AvaliacaoSemanalPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("asrm");
  const [asrmScores, setAsrmScores] = useState<number[]>(Array(5).fill(-1));
  const [phq9Scores, setPhq9Scores] = useState<number[]>(Array(9).fill(-1));
  const [fastScores, setFastScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [safetyFlag, setSafetyFlag] = useState(false);
  const [success, setSuccess] = useState(false);

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

    try {
      const body: Record<string, unknown> = {
        date: getWeekEndDate(),
      };
      if (asrmComplete) body.asrmScores = asrmScores;
      if (phq9Complete) body.phq9Scores = phq9Scores;
      if (fastComplete) {
        body.fastScores = fastScores;
      }
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
            <p className="mt-2 text-sm text-amber-400">
              Sinais de humor elevado detectados (pontuação {asrmTotal}) — pode ser útil compartilhar esse resultado com seu profissional de saúde.
            </p>
          )}
          {phq9Total >= 10 && (
            <p className="mt-2 text-sm text-blue-400">
              Sinais de humor baixo detectados (pontuação {phq9Total}) — considere compartilhar esse resultado na sua próxima consulta.
            </p>
          )}
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

      {/* Progress indicator */}
      {(() => {
        const steps: Step[] = ["asrm", "phq9", "fast", "review"];
        const stepLabels: Record<Step, string> = { asrm: "Mania", phq9: "Depressão", fast: "Funcionamento", review: "Revisão" };
        const currentIdx = steps.indexOf(step) + 1;
        return (
          <div
            className="mb-6 flex gap-1"
            role="progressbar"
            aria-valuenow={currentIdx}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label={`Etapa ${currentIdx} de 4: ${stepLabels[step]}`}
          >
            {steps.map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  s === step
                    ? "bg-primary"
                    : steps.indexOf(s) < steps.indexOf(step)
                      ? "bg-primary/40"
                      : "bg-border"
                }`}
              />
            ))}
          </div>
        );
      })()}

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
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
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
          <div className="flex justify-between">
            <div />
            <button
              onClick={() => setStep("phq9")}
              disabled={!asrmComplete}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
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
                    className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                      phq9Scores[idx] === opt.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                    {"hint" in opt && opt.hint && (
                      <span className="block text-[10px] opacity-60 mt-0.5">{opt.hint}</span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
          ))}

          {/* Safety nudge inline after item 9 */}
          {showSafetyNudge && <SafetyNudge phq9Item9={phq9Item9} compact />}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("asrm")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep("fast")}
              disabled={!phq9Complete}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
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
                    className={`flex-1 rounded-lg border px-1 py-2 text-center text-xs transition-colors ${
                      fastScores[item.key] === val
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted">
                <span>Muito difícil</span>
                <span>Sem dificuldade</span>
              </div>
            </Card>
          ))}
          <div className="flex justify-between">
            <button
              onClick={() => setStep("phq9")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!fastComplete}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
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
                    asrmTotal >= 6 ? "text-amber-400" : "text-green-400"
                  }`}
                >
                  {asrmTotal}
                  <span className="text-xs font-normal text-muted">/20</span>
                </div>
                {asrmTotal >= 6 ? (
                  <div className="text-[10px] text-amber-400">Acima do ponto de atenção — vale mencionar na consulta</div>
                ) : (
                  <div className="text-[10px] text-green-400">Sem sinais significativos</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted">Depressão</div>
                <div
                  className={`text-xl font-bold ${
                    phq9Total >= 15
                      ? "text-red-400"
                      : phq9Total >= 10
                        ? "text-amber-400"
                        : phq9Total >= 5
                          ? "text-blue-400"
                          : "text-green-400"
                  }`}
                >
                  {phq9Total}
                  <span className="text-xs font-normal text-muted">/27</span>
                </div>
                <div className="text-[10px] text-muted">
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
                <div className="text-[10px] text-muted">Funcionamento</div>
              </div>
            </div>
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
              className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              placeholder="Algo relevante sobre esta semana..."
            />
          </Card>

          {showSafetyNudge && <SafetyNudge phq9Item9={phq9Item9} />}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("fast")}
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-primary/50"
            >
              Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Salvar avaliação"}
            </button>
          </div>

          <p className="text-center text-[10px] text-muted">
            Questionários validados internacionalmente: mania (ASRM, Altman), depressão (PHQ-9, Kroenke),
            funcionamento (inspirado no FAST, Vieta). Não substitui avaliação profissional.
          </p>
        </div>
      )}
    </div>
  );
}
