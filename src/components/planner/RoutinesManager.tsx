"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { CATEGORY_COLORS } from "@/lib/planner/categories";

interface Routine {
  id: string;
  title: string;
  category: string;
  kind: string;
  startAt: string;
  endAt: string;
  energyCost: number;
  recurrence: {
    freq: string;
    weekDays: string | null;
    until: string | null;
  } | null;
}

const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function freqLabel(freq: string, weekDays: string | null): string {
  if (freq === "DAILY") return "Todo dia";
  if (freq === "WEEKLY" && weekDays) {
    const days = weekDays.split(",").map(Number).map((d) => WEEKDAY_NAMES[d]);
    return days.join(", ");
  }
  return freq;
}

export function RoutinesManager({ routines: initial }: { routines: Routine[] }) {
  const [routines, setRoutines] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handlePause(id: string) {
    setLoading(id);
    try {
      // Pause = set until to now
      const res = await fetch(`/api/planner/blocks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRoutine: false }),
      });
      if (res.ok) {
        setRoutines((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esta rotina permanentemente?")) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/planner/blocks/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRoutines((prev) => prev.filter((r) => r.id !== id));
      }
    } finally {
      setLoading(null);
    }
  }

  if (routines.length === 0) {
    return (
      <Card>
        <p className="text-center text-muted py-4">
          Nenhuma rotina ativa. Crie um bloco recorrente no planejador e marque como rotina.
        </p>
        <div className="text-center">
          <button
            onClick={() => router.push("/planejador")}
            className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Ir para o planejador
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Rotinas sao blocos que repetem automaticamente. Pausar uma rotina remove a marcacao de rotina mas mantem o bloco.
      </p>
      {routines.map((routine) => {
        const colors = CATEGORY_COLORS[routine.category] || CATEGORY_COLORS.outro;
        const isActive = !routine.recurrence?.until;
        return (
          <Card key={routine.id} className={`${colors}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-foreground">
                  {routine.title}
                  {routine.kind === "ANCHOR" && <span className="ml-1 opacity-60 text-sm">⚓</span>}
                </h3>
                <p className="text-sm text-muted">
                  {formatTime(routine.startAt)} — {formatTime(routine.endAt)}
                  {" · "}
                  {routine.recurrence ? freqLabel(routine.recurrence.freq, routine.recurrence.weekDays) : "Sem recorrencia"}
                </p>
                <p className="text-xs text-muted">
                  Energia: {routine.energyCost} · {isActive ? "Ativa" : "Pausada"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePause(routine.id)}
                  disabled={loading === routine.id}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:border-primary/50 disabled:opacity-50"
                >
                  Pausar
                </button>
                <button
                  onClick={() => handleDelete(routine.id)}
                  disabled={loading === routine.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
