"use client";

import { useState, useCallback, useEffect } from "react";
import { localToday } from "@/lib/dateUtils";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { ScaleSelector } from "@/components/ScaleSelector";
import { MOOD_LABELS, ENERGY_LABELS, ANXIETY_LABELS, IRRITABILITY_LABELS, MEDICATION_OPTIONS, WARNING_SIGNS } from "@/lib/constants";
import { MedicationDoseCheckin } from "@/components/MedicationDoseCheckin";

interface SnapshotEntry {
  id: string;
  capturedAt: string;
  mood: number;
  energy: number;
  anxiety: number;
  irritability: number;
}

export default function CheckinPage() {
  const router = useRouter();
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);

  // Snapshot timeline
  const [todaySnapshots, setTodaySnapshots] = useState<SnapshotEntry[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);

  const today = localToday();

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
      .then((logs: { date: string; totalHours: number; excluded: boolean }[]) => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

        const yesterdayLogs = logs.filter((l) => l.date === yesterdayStr && !l.excluded);
        if (yesterdayLogs.length > 0) {
          const total = Math.round(yesterdayLogs.reduce((sum, l) => sum + l.totalHours, 0) * 10) / 10;
          setAutoSleepHours(total);
          setSleepHours(String(total));
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

    if (anxiety === null || irritability === null) {
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

        setSuccess(true);
        setTimeout(() => router.push("/hoje"), 2500);
      } else {
        // Create new snapshot
        const clientRequestId = `${today}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const isFirst = todaySnapshots.length === 0;

        const res = await fetch("/api/diario/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mood,
            energy,
            anxiety,
            irritability,
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

        setSuccess(true);
        setTimeout(() => router.push("/hoje"), 2500);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-center py-8">
          <p className="text-lg font-semibold text-foreground">Check-in salvo!</p>
          <p className="text-sm text-muted mt-2">Redirecionando...</p>
        </Card>
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
                  <div className="flex gap-2 mt-1 text-[10px] text-muted">
                    <span title="Humor">H:{snap.mood}</span>
                    <span title="Energia">E:{snap.energy}</span>
                    <span title="Ansiedade">A:{snap.anxiety}</span>
                    <span title="Irritabilidade">I:{snap.irritability}</span>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setEditingSnapshotId(snap.id);
                        setMood(snap.mood);
                        setEnergy(snap.energy);
                        setAnxiety(snap.anxiety);
                        setIrritability(snap.irritability);
                      }}
                      className="mt-1 text-[10px] text-primary hover:underline"
                    >
                      Editar ({minsLeft}min)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted mt-2">
            Registre novamente para captar mudanças ao longo do dia.
          </p>
        </Card>
      )}

      {error && (
        <Alert variant="danger" className="mb-4">{error}</Alert>
      )}

      <div className="space-y-5">
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

        {/* Anxiety */}
        <Card>
          <ScaleSelector
            label="Ansiedade"
            value={anxiety}
            onChange={setAnxiety}
            labels={ANXIETY_LABELS}
          />
        </Card>

        {/* Irritability */}
        <Card>
          <ScaleSelector
            label="Irritabilidade"
            value={irritability}
            onChange={setIrritability}
            labels={IRRITABILITY_LABELS}
          />
        </Card>

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
                  <span className="font-medium">{autoSleepHours}h</span>
                  <span className="text-muted ml-1">(total de ontem)</span>
                </div>
              ) : (
                <p className="text-sm text-amber-600">
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
                className="block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

        {/* Warning signs (collapsible) */}
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

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-dark disabled:opacity-50"
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
