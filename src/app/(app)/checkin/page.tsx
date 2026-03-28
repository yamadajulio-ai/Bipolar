"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { localToday } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ScaleSelector } from "@/components/ScaleSelector";
import { FEELING_LABELS, MOOD_LABELS, ENERGY_LABELS, ANXIETY_LABELS, IRRITABILITY_LABELS, MEDICATION_OPTIONS, WARNING_SIGNS } from "@/lib/constants";
import { MedicationDoseCheckin } from "@/components/MedicationDoseCheckin";
import { track } from "@/lib/telemetry";
import { hapticSuccess } from "@/lib/capacitor/haptics";
import { isNative, registerPushNotifications } from "@/lib/capacitor";
import { setupDefaultReminders } from "@/lib/capacitor/notifications";

type CheckinMode = "minimal" | "complete";

interface SnapshotEntry {
  id: string;
  capturedAt: string;
  feeling: number | null;
  mood: number;
  energy: number;
  anxiety: number;
  irritability: number;
}

export default function CheckinPage() {
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = useState<CheckinMode>("minimal");
  const [feeling, setFeeling] = useState(3);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [anxiety, setAnxiety] = useState<number | null>(null);
  const [irritability, setIrritability] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState("7");
  const [autoSleep, setAutoSleep] = useState(false);
  const [autoSleepHours, setAutoSleepHours] = useState<number | null>(null);
  const [autoSleepLoading, setAutoSleepLoading] = useState(false);
  const [medication, setMedication] = useState("sim");
  const [hasDoseTracking, setHasDoseTracking] = useState<boolean | null>(null);
  const [showSigns, setShowSigns] = useState(false);
  const [selectedSigns, setSelectedSigns] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);

  // Snapshot timeline
  const [todaySnapshots, setTodaySnapshots] = useState<SnapshotEntry[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);

  // Adaptive check-in: suggest complete mode after 3 consecutive minimal check-ins
  const [minimalStreak, setMinimalStreak] = useState(0);
  const [streakBannerDismissed, setStreakBannerDismissed] = useState(false);

  const today = localToday();
  const DRAFT_KEY = `checkin-draft-${today}`;
  const draftRestored = useRef(false);

  // Track page open
  useEffect(() => {
    track({ name: "checkin_open" });
  }, []);

  // Restore draft on mount
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (typeof draft.feeling === "number") setFeeling(draft.feeling);
        if (typeof draft.mood === "number") setMood(draft.mood);
        if (typeof draft.energy === "number") setEnergy(draft.energy);
        if (typeof draft.anxiety === "number") setAnxiety(draft.anxiety);
        if (typeof draft.irritability === "number") setIrritability(draft.irritability);
        if (Array.isArray(draft.warningSigns) && draft.warningSigns.length > 0) {
          setSelectedSigns(draft.warningSigns);
          setShowSigns(true);
        }
        if (typeof draft.note === "string" && draft.note) setNote(draft.note);
        if (draft.mode === "complete") setMode("complete");
      }
    } catch { /* ignore corrupt draft */ }
  }, [DRAFT_KEY]);

  // Load minimal check-in streak on mount
  useEffect(() => {
    try {
      const streak = parseInt(sessionStorage.getItem("checkin_minimal_streak") || "0", 10);
      if (Number.isFinite(streak) && streak > 0) setMinimalStreak(streak);
    } catch { /* ignore */ }
  }, []);

  // Save draft on changes (debounced 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ feeling, mood, energy, anxiety, irritability, warningSigns: selectedSigns, note, mode }),
        );
      } catch { /* storage full — ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [feeling, mood, energy, anxiety, irritability, selectedSigns, note, mode, DRAFT_KEY]);

  // Load today's existing snapshots
  useEffect(() => {
    fetch(`/api/diario/snapshots?date=${today}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: SnapshotEntry[]) => setTodaySnapshots(data))
      .catch(() => {})
      .finally(() => setSnapshotsLoading(false));
  }, [today]);

  useEffect(() => {
    if (!autoSleep) return;
    setAutoSleepLoading(true);
    fetch(`/api/sono?days=3`)
      .then((r) => r.ok ? r.json() : [])
      .then((logs: { date: string; totalHours: number; awakeMinutes: number; excluded: boolean }[]) => {
        // The night of "yesterday" is logged under TODAY's date (wake date).
        // E.g., night 24→25 has date=25/03. So check today first, then yesterday.
        const now = new Date();
        const todayStr = now.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

        // Filter real sleep (>= 2h, not excluded) for today or yesterday
        const realLogs = logs.filter((l) => !l.excluded && l.totalHours >= 2);
        const todayLogs = realLogs.filter((l) => l.date === todayStr);
        const yesterdayLogs = realLogs.filter((l) => l.date === yesterdayStr);

        // Prefer today's logs (last night's sleep), fallback to yesterday
        const chosen = todayLogs.length > 0 ? todayLogs : yesterdayLogs;

        if (chosen.length > 0) {
          // Sum actual sleep: totalHours - awakeMinutes for each log
          const actualSleep = chosen.reduce((sum, l) => {
            const awakeHrs = (l.awakeMinutes || 0) / 60;
            return sum + Math.max(0, l.totalHours - awakeHrs);
          }, 0);
          // Keep 2 decimal places for precision (5.95h = 5h57min, not 6h00)
          const rounded = Math.round(actualSleep * 100) / 100;
          setAutoSleepHours(rounded);
          setSleepHours(String(Math.round(actualSleep * 10) / 10));
        } else {
          setAutoSleepHours(null);
        }
      })
      .catch(() => setAutoSleepHours(null))
      .finally(() => setAutoSleepLoading(false));
  }, [autoSleep, today]);

  const toggleSign = useCallback((key: string) => {
    setSelectedSigns((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key],
    );
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setError("");

    if (mode === "complete" && (anxiety === null || irritability === null)) {
      setError("Selecione um nível para ansiedade e irritabilidade.");
      setSaving(false);
      return;
    }

    try {
      if (editingSnapshotId) {
        // Edit existing snapshot via PATCH
        const res = await fetch("/api/diario/snapshots", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshotId: editingSnapshotId,
            feeling,
            mood,
            energy,
            anxiety,
            irritability,
            warningSignsNow: selectedSigns.length > 0 ? JSON.stringify(selectedSigns) : undefined,
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          setError(body.error || "Erro ao editar registro.");
          return;
        }

        // Clear draft on success
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        track({ name: "checkin_complete", mode, snapshotCount: todaySnapshots.length });
        setSuccess(true);
        redirectTimer.current = setTimeout(() => router.push("/hoje"), 8000);
      } else {
        // Create new snapshot
        const clientRequestId = `${today}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const isFirst = todaySnapshots.length === 0;

        const res = await fetch("/api/diario/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            feeling,
            mood,
            energy,
            ...(anxiety !== null ? { anxiety } : {}),
            ...(irritability !== null ? { irritability } : {}),
            warningSignsNow: selectedSigns.length > 0 ? JSON.stringify(selectedSigns) : undefined,
            clientRequestId,
            ...(isFirst ? {
              sleepHours: parseFloat(sleepHours) || 0,
              tookMedication: medication,
            } : {}),
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          setError(body.error || body.errors?.geral?.[0] || "Erro ao salvar check-in.");
          return;
        }

        // Update minimal check-in streak
        try {
          if (mode === "minimal") {
            const prev = parseInt(sessionStorage.getItem("checkin_minimal_streak") || "0", 10);
            const next = (Number.isFinite(prev) ? prev : 0) + 1;
            sessionStorage.setItem("checkin_minimal_streak", String(next));
          } else {
            sessionStorage.setItem("checkin_minimal_streak", "0");
          }
        } catch { /* ignore */ }

        // Clear draft on success
        try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
        track({ name: "checkin_complete", mode, snapshotCount: todaySnapshots.length + 1 });
        hapticSuccess();
        setSuccess(true);

        // Contextual push permission: ask after first successful check-in (native only)
        if (isNative()) {
          import('@capacitor/push-notifications').then(({ PushNotifications }) =>
            PushNotifications.checkPermissions().then((result) => {
              if (result.receive === 'prompt') {
                registerPushNotifications().then((token) => {
                  if (token) {
                    fetch('/api/push-subscriptions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: 'apns', token }),
                    }).catch(() => {});
                  }
                  setupDefaultReminders().catch(() => {});
                }).catch(() => {});
              }
            }).catch(() => {})
          ).catch(() => {});
        }

        redirectTimer.current = setTimeout(() => router.push("/hoje"), 8000);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    const snapshotCount = todaySnapshots.length + (editingSnapshotId ? 0 : 1);
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <div className="rounded-[var(--radius-card)] bg-success-bg-subtle border border-success-border p-6 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-bg-subtle">
            <svg className="w-6 h-6 text-success-fg" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-success-fg">Registrado!</p>
          {snapshotCount > 0 && (
            <p className="text-sm text-success-fg">
              {snapshotCount} {snapshotCount === 1 ? "registro" : "registros"} hoje
            </p>
          )}
          <p className="text-sm text-muted">Que tal registrar seu sono também?</p>
          <Link
            href="/sono/novo"
            onClick={() => { if (redirectTimer.current) clearTimeout(redirectTimer.current); }}
            className="inline-block text-sm font-medium text-primary hover:text-primary-dark underline"
          >
            Registrar sono
          </Link>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => router.push("/hoje")}
            className="text-sm font-medium text-primary hover:text-primary-dark underline"
          >
            Ir para a tela inicial
          </button>
          <p className="text-center text-xs text-muted">Redirecionando automaticamente em alguns segundos...</p>
        </div>
      </div>
    );
  }

  const isFirstOfDay = todaySnapshots.length === 0;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-bold">Check-in Rápido</h1>
      <p className="mb-6 text-sm text-muted">
        Como você está <strong>agora</strong>? Leva menos de 30 segundos.
      </p>

      {/* Timeline of today's previous check-ins */}
      {!snapshotsLoading && todaySnapshots.length > 0 && (
        <Card className="mb-5">
          <p className="text-xs font-medium text-muted mb-2">
            Registros de hoje ({todaySnapshots.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {todaySnapshots.map((snap, idx) => {
              const time = new Date(snap.capturedAt).toLocaleTimeString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                hour: "2-digit",
                minute: "2-digit",
              });
              const isLast = idx === todaySnapshots.length - 1;
              const elapsed = Date.now() - new Date(snap.capturedAt).getTime();
              const canEdit = isLast && elapsed <= 15 * 60 * 1000;
              const minsLeft = canEdit ? Math.ceil((15 * 60 * 1000 - elapsed) / 60_000) : 0;

              return (
                <div
                  key={snap.id}
                  className={`shrink-0 rounded-md border bg-surface px-3 py-2 text-center ${
                    editingSnapshotId === snap.id ? "border-primary" : "border-border"
                  }`}
                >
                  <p className="text-xs font-medium text-foreground">{time}</p>
                  <div className="flex gap-2 mt-1 text-[11px] text-muted">
                    {snap.feeling && <span title="Sentimento">S:{snap.feeling}</span>}
                    <span title="Humor">H:{snap.mood}</span>
                    <span title="Energia">E:{snap.energy}</span>
                    <span title="Ansiedade">A:{snap.anxiety}</span>
                    <span title="Irritabilidade">I:{snap.irritability}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingSnapshotId(snap.id);
                        if (snap.feeling) setFeeling(snap.feeling);
                        setMood(snap.mood);
                        setEnergy(snap.energy);
                        setAnxiety(snap.anxiety);
                        setIrritability(snap.irritability);
                      }}
                      className="mt-1 text-[11px] text-primary hover:underline"
                    >
                      Editar ({minsLeft}min)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted mt-2">
            Registre novamente para captar mudanças ao longo do dia.
          </p>
        </Card>
      )}

      {/* Adaptive suggestion: after 3+ consecutive minimal check-ins */}
      {minimalStreak >= 3 && mode === "minimal" && !streakBannerDismissed && (
        <div className="mb-4 rounded-[var(--radius-card)] border border-primary/30 bg-primary/5 p-4 text-sm" role="status">
          <p className="text-foreground mb-2">
            Você fez {minimalStreak} check-ins rápidos seguidos. Que tal um check-in completo hoje? Detalhes extras ajudam a identificar padrões.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setMode("complete"); track({ name: "checkin_start", mode: "complete" }); }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark transition-colors"
            >
              Fazer completo
            </button>
            <button
              type="button"
              onClick={() => setStreakBannerDismissed(true)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mb-4">{error}</Alert>
      )}

      <div className="space-y-5">
        {/* Feeling — subjective well-being */}
        <Card>
          <ScaleSelector
            label="Como você se sente?"
            value={feeling}
            onChange={setFeeling}
            labels={FEELING_LABELS}
          />
        </Card>

        {/* Mood */}
        <Card>
          <ScaleSelector
            label="Humor"
            value={mood}
            onChange={setMood}
            labels={MOOD_LABELS}
          />
        </Card>

        {/* Energy */}
        <Card>
          <ScaleSelector
            label="Energia"
            value={energy}
            onChange={setEnergy}
            labels={ENERGY_LABELS}
          />
        </Card>

        {/* Mode toggle */}
        {mode === "minimal" ? (
          <button
            type="button"
            onClick={() => { setMode("complete"); track({ name: "checkin_start", mode: "complete" }); }}
            className="w-full text-center text-sm text-primary hover:text-primary-dark transition-colors py-1"
          >
            Registrar mais detalhes &rarr;
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode("minimal"); track({ name: "checkin_start", mode: "minimal" }); }}
            className="w-full text-center text-sm text-muted hover:text-foreground transition-colors py-1"
          >
            &larr; Modo rápido
          </button>
        )}

        {/* Anxiety — only in complete mode */}
        {mode === "complete" && (
          <Card>
            <ScaleSelector
              label="Ansiedade"
              value={anxiety}
              onChange={setAnxiety}
              labels={ANXIETY_LABELS}
            />
          </Card>
        )}

        {/* Irritability — only in complete mode */}
        {mode === "complete" && (
          <Card>
            <ScaleSelector
              label="Irritabilidade"
              value={irritability}
              onChange={setIrritability}
              labels={IRRITABILITY_LABELS}
            />
          </Card>
        )}

        {/* Sleep — only on first check-in of the day */}
        {isFirstOfDay && (
          <Card>
            <label htmlFor="sleep-hours" className="block text-sm font-medium text-foreground mb-1">
              Horas de sono
            </label>
            <p className="text-xs text-muted mb-2">Quantas horas você dormiu ontem?</p>

            <label className="flex items-center gap-2 text-sm text-muted mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSleep}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAutoSleep(checked);
                  if (!checked) {
                    setSleepHours("7");
                    setAutoSleepHours(null);
                  }
                }}
                className="rounded border-border"
              />
              Usar registro de sono automático
            </label>

            {autoSleep ? (
              autoSleepLoading ? (
                <p className="text-sm text-muted">Buscando registro de sono...</p>
              ) : autoSleepHours !== null ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                  <span className="font-medium">
                    {Math.floor(autoSleepHours)}h {String(Math.round((autoSleepHours - Math.floor(autoSleepHours)) * 60)).padStart(2, "0")}min
                  </span>
                  <span className="text-muted ml-1">(sono da última noite)</span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Nenhum registro de sono recente encontrado. Verifique se a integração com o Health Auto Export está ativa na{" "}
                  <a href="/sono" className="text-primary hover:underline">página de sono</a>{" "}
                  ou preencha manualmente abaixo.
                </p>
              )
            ) : null}

            {(!autoSleep || (autoSleep && autoSleepHours === null && !autoSleepLoading)) && (
              <input
                id="sleep-hours"
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            )}
          </Card>
        )}

        {/* Medication — per-dose tracking always visible; legacy only on first check-in */}
        <MedicationDoseCheckin
          date={today}
          onTrackingStatus={(has) => setHasDoseTracking(has)}
          onComplete={(legacyValue) => setMedication(legacyValue)}
        />

        {isFirstOfDay && !hasDoseTracking ? (
          <Card>
            <div role="group" aria-label="Medicação de hoje">
              <label className="block text-sm font-medium text-foreground mb-1">Tomou a medicação hoje?</label>
              <p className="text-xs text-muted mb-3">Refere-se ao dia de hoje ({new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" })}). Se ainda não tomou, marque &quot;Ainda não&quot;.</p>
              <div className="flex gap-2">
                {MEDICATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMedication(opt.value)}
                    aria-pressed={medication === opt.value}
                    className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      medication === opt.value
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-surface text-muted hover:border-primary/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <a
                href="/medicamentos"
                className="block mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-center text-primary hover:bg-primary/10 transition-colors"
              >
                Toma mais de um medicamento? Cadastre seus horários para controle por dose
              </a>
            </div>
          </Card>
        ) : null}

        {/* Warning signs (collapsible) — only in complete mode */}
        {mode === "complete" && (
          <Card>
            <button
              type="button"
              onClick={() => setShowSigns(!showSigns)}
              className="flex w-full items-center justify-between text-sm font-medium text-foreground"
              aria-expanded={showSigns}
              aria-controls="warning-signs-panel"
            >
              <span>Sinais de alerta {selectedSigns.length > 0 && `(${selectedSigns.length})`}</span>
              <span className="text-muted" aria-hidden="true">{showSigns ? "▲" : "▼"}</span>
            </button>
            {showSigns && (
              <div id="warning-signs-panel" className="mt-3 space-y-2">
                {WARNING_SIGNS.map((sign) => (
                  <label key={sign.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSigns.includes(sign.key)}
                      onChange={() => toggleSign(sign.key)}
                      className="rounded border-border"
                    />
                    <span className="text-foreground">{sign.label}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Notes — only in complete mode */}
        {mode === "complete" && (
          <Card>
            <label className="block text-sm font-medium text-foreground mb-1">
              Observações (opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              rows={2}
              className="block w-full rounded-md border border-control-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none"
              placeholder="Algo que queira registrar..."
            />
          </Card>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          aria-label={saving ? "Salvando check-in" : editingSnapshotId ? "Salvar edição do check-in" : isFirstOfDay ? "Salvar check-in" : "Registrar momento atual"}
          className="w-full rounded-lg bg-primary px-4 py-3 min-h-[44px] font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Salvando..." : editingSnapshotId ? "Salvar edição" : isFirstOfDay ? "Salvar check-in" : "Registrar momento"}
        </button>

        <p className="text-center text-xs text-muted">
          {isFirstOfDay ? (
            <>Para registro detalhado, use o{" "}
              <a href="/diario/novo" className="text-primary hover:underline">diário completo</a>.
            </>
          ) : (
            <>Este registro captura como você está agora. Sono fica no primeiro check-in do dia.</>
          )}
        </p>
      </div>
    </div>
  );
}
