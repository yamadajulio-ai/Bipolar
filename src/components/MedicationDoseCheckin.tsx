"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/Card";
import Link from "next/link";

interface DoseStatus {
  scheduleId: string;
  medicationName: string;
  dosageText: string | null;
  timeLocal: string;
  status: "TAKEN" | "MISSED" | "PENDING";
  isOverdue: boolean;
}

interface MedicationDaySummary {
  date: string;
  state: string;
  expected: number;
  taken: number;
  missed: number;
  pending: number;
  doses: DoseStatus[];
}

interface Props {
  date: string;
  /** Called when all doses are logged, with the derived legacy value */
  onComplete?: (legacyValue: string) => void;
  /** Called when we know if dose tracking is available */
  onTrackingStatus?: (hasTracking: boolean) => void;
}

/** Get yesterday's date string (YYYY-MM-DD) in America/Sao_Paulo */
function getYesterdayDate(todayDate: string): string {
  const d = new Date(todayDate + "T12:00:00Z");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function MedicationDoseCheckin({ date, onComplete, onTrackingStatus }: Props) {
  const [summary, setSummary] = useState<MedicationDaySummary | null>(null);
  const [yesterdaySummary, setYesterdaySummary] = useState<MedicationDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const yesterdayDate = getYesterdayDate(date);

  const fetchSummary = useCallback(async () => {
    try {
      const [todayRes, yesterdayRes] = await Promise.all([
        fetch(`/api/medicamentos/summary?date=${date}`),
        fetch(`/api/medicamentos/summary?date=${yesterdayDate}`),
      ]);
      if (todayRes.ok) {
        setSummary(await todayRes.json());
      }
      if (yesterdayRes.ok) {
        const yd: MedicationDaySummary = await yesterdayRes.json();
        // Only show if there are pending doses from yesterday
        const hasPending = yd.doses.some((d) => d.status === "PENDING");
        setYesterdaySummary(hasPending ? yd : null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [date, yesterdayDate]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // Notify parent about tracking status (must be before any early return)
  const hasTracking = summary ? summary.state !== "NOT_TRACKED" : null;
  const onTrackingStatusRef = useRef(onTrackingStatus);
  onTrackingStatusRef.current = onTrackingStatus;

  useEffect(() => {
    if (hasTracking !== null) {
      onTrackingStatusRef.current?.(hasTracking);
    }
  }, [hasTracking]);

  async function logDose(scheduleId: string, status: "TAKEN" | "MISSED") {
    setSaving((prev) => new Set(prev).add(scheduleId));
    try {
      const res = await fetch("/api/medicamentos/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: [{ scheduleId, date, status, source: "QUICK_CHECKIN" }],
        }),
      });
      if (res.ok) {
        await fetchSummary();
        // Check if all done
        if (summary) {
          const updatedPending = summary.doses.filter(
            (d) => d.scheduleId !== scheduleId && d.status === "PENDING",
          ).length;
          if (updatedPending === 0) {
            const allTaken = summary.doses.every(
              (d) => d.scheduleId === scheduleId ? status === "TAKEN" : d.status === "TAKEN",
            );
            onComplete?.(allTaken ? "sim" : "nao_sei");
          }
        }
      }
    } catch { /* silent */ }
    finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
    }
  }

  async function logYesterdayDose(scheduleId: string, status: "TAKEN" | "MISSED") {
    setSaving((prev) => new Set(prev).add(scheduleId));
    try {
      const res = await fetch("/api/medicamentos/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: [{ scheduleId, date: yesterdayDate, status, source: "QUICK_CHECKIN" }],
        }),
      });
      if (res.ok) {
        // Re-fetch to update both summaries
        const ydRes = await fetch(`/api/medicamentos/summary?date=${yesterdayDate}`);
        if (ydRes.ok) {
          const yd: MedicationDaySummary = await ydRes.json();
          const hasPending = yd.doses.some((d) => d.status === "PENDING");
          setYesterdaySummary(hasPending ? yd : null);
        }
      }
    } catch { /* silent */ }
    finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(scheduleId);
        return next;
      });
    }
  }

  async function logAllCurrent(status: "TAKEN" | "MISSED") {
    if (!summary) return;
    const pendingDoses = summary.doses.filter(
      (d) => d.status === "PENDING" && (d.isOverdue || status === "TAKEN"),
    );
    if (pendingDoses.length === 0) return;

    const allIds = new Set(pendingDoses.map((d) => d.scheduleId));
    setSaving(allIds);

    try {
      const res = await fetch("/api/medicamentos/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: pendingDoses.map((d) => ({
            scheduleId: d.scheduleId,
            date,
            status,
            source: "QUICK_CHECKIN",
          })),
        }),
      });
      if (res.ok) {
        await fetchSummary();
      }
    } catch { /* silent */ }
    finally { setSaving(new Set()); }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-muted">Carregando medicamentos...</p>
      </Card>
    );
  }

  if (!summary || summary.state === "NOT_TRACKED") {
    return null; // No medications configured, caller shows legacy UI
  }

  const overdueDoses = summary.doses.filter((d) => d.status === "PENDING" && d.isOverdue);
  const pendingDoses = summary.doses.filter((d) => d.status === "PENDING" && !d.isOverdue);
  const loggedDoses = summary.doses.filter((d) => d.status !== "PENDING");

  const progressPct = summary.expected > 0
    ? Math.round(((summary.taken + summary.missed) / summary.expected) * 100)
    : 0;

  const yesterdayPending = yesterdaySummary?.doses.filter((d) => d.status === "PENDING") ?? [];

  return (
    <Card>
      {/* Yesterday's pending doses */}
      {yesterdayPending.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
            Ontem — doses não registradas
          </p>
          <div className="space-y-2">
            {yesterdayPending.map((dose) => (
              <div key={dose.scheduleId} className="flex items-center gap-2 rounded-md border border-amber-200 bg-surface dark:bg-surface-raised dark:border-amber-700 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {dose.medicationName}
                    {dose.dosageText && (
                      <span className="text-muted font-normal ml-1">({dose.dosageText})</span>
                    )}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {dose.timeLocal} — ontem
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => logYesterdayDose(dose.scheduleId, "TAKEN")}
                    disabled={saving.has(dose.scheduleId)}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
                  >
                    Tomei
                  </button>
                  <button
                    onClick={() => logYesterdayDose(dose.scheduleId, "MISSED")}
                    disabled={saving.has(dose.scheduleId)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
                  >
                    Não
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-foreground">
          Medicação de hoje
        </label>
        <span className="text-xs text-muted">
          {summary.taken} de {summary.expected} doses
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all bg-primary"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Overdue / current doses */}
      {overdueDoses.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-amber-600 mb-2">
            Agora / atrasadas
          </p>
          <div className="space-y-2">
            {overdueDoses.map((dose) => (
              <DoseRow
                key={dose.scheduleId}
                dose={dose}
                saving={saving.has(dose.scheduleId)}
                onLog={logDose}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming doses */}
      {pendingDoses.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-muted mb-2">
            Mais tarde
          </p>
          <div className="space-y-2">
            {pendingDoses.map((dose) => (
              <DoseRow
                key={dose.scheduleId}
                dose={dose}
                saving={saving.has(dose.scheduleId)}
                onLog={logDose}
              />
            ))}
          </div>
        </div>
      )}

      {/* Already logged */}
      {loggedDoses.length > 0 && (
        <div className="mb-3">
          <div className="space-y-1.5">
            {loggedDoses.map((dose) =>
              editing.has(dose.scheduleId) ? (
                <DoseRow
                  key={dose.scheduleId}
                  dose={{ ...dose, status: "PENDING", isOverdue: true }}
                  saving={saving.has(dose.scheduleId)}
                  onLog={(id, status) => {
                    logDose(id, status);
                    setEditing((prev) => {
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                    });
                  }}
                />
              ) : (
                <button
                  key={dose.scheduleId}
                  type="button"
                  onClick={() =>
                    setEditing((prev) => new Set(prev).add(dose.scheduleId))
                  }
                  className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 w-full text-left transition-colors ${
                    dose.status === "TAKEN"
                      ? "bg-emerald-50 text-emerald-700 active:bg-emerald-100"
                      : "bg-red-50 text-red-700 active:bg-red-100"
                  }`}
                >
                  <span>{dose.status === "TAKEN" ? "✓" : "✗"}</span>
                  <span className="font-medium">{dose.medicationName}</span>
                  {dose.dosageText && (
                    <span className="text-muted">({dose.dosageText})</span>
                  )}
                  <span className="ml-auto flex items-center gap-1.5">
                    {dose.timeLocal}
                    <span className="text-[11px] opacity-60 underline">corrigir</span>
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {overdueDoses.length > 1 && (
        <button
          onClick={() => logAllCurrent("TAKEN")}
          className="w-full mt-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
        >
          Marcar todas as de agora como tomadas
        </button>
      )}

      <Link
        href="/medicamentos"
        className="block mt-3 text-center text-[11px] text-muted hover:text-primary"
      >
        Gerenciar medicamentos
      </Link>
    </Card>
  );
}

function DoseRow({
  dose,
  saving,
  onLog,
}: {
  dose: DoseStatus;
  saving: boolean;
  onLog: (scheduleId: string, status: "TAKEN" | "MISSED") => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {dose.medicationName}
          {dose.dosageText && (
            <span className="text-muted font-normal ml-1">({dose.dosageText})</span>
          )}
        </p>
        <p className={`text-xs ${dose.isOverdue ? "text-amber-600" : "text-muted"}`}>
          {dose.timeLocal}
          {dose.isOverdue && " — atrasado"}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button
          onClick={() => onLog(dose.scheduleId, "TAKEN")}
          disabled={saving}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          Tomei
        </button>
        <button
          onClick={() => onLog(dose.scheduleId, "MISSED")}
          disabled={saving}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
        >
          Não
        </button>
      </div>
    </div>
  );
}
