"use client";

import { useState } from "react";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function midpoint(bedtime: string, wakeTime: string): number {
  let bed = timeToMinutes(bedtime);
  const wake = timeToMinutes(wakeTime);
  // Normalize: if bedtime is before midnight but wake is after, add 24h to bedtime
  if (bed > wake) bed -= 1440;
  return ((bed + wake) / 2 + 1440) % 1440;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(((mins % 1440) + 1440) % 1440 / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Result {
  weekdayMidpoint: number;
  weekendMidpoint: number;
  jetLagMinutes: number;
}

export function JetLagCalculator() {
  const [weekBed, setWeekBed] = useState("23:00");
  const [weekWake, setWeekWake] = useState("07:00");
  const [weekendBed, setWeekendBed] = useState("01:00");
  const [weekendWake, setWeekendWake] = useState("10:00");
  const [result, setResult] = useState<Result | null>(null);

  function calculate() {
    const wkMid = midpoint(weekBed, weekWake);
    const weMid = midpoint(weekendBed, weekendWake);
    let diff = Math.abs(weMid - wkMid);
    if (diff > 720) diff = 1440 - diff;
    setResult({ weekdayMidpoint: wkMid, weekendMidpoint: weMid, jetLagMinutes: diff });
  }

  const jetLagHours = result ? result.jetLagMinutes / 60 : 0;
  let severity: { label: string; color: string; desc: string } | null = null;
  if (result) {
    if (jetLagHours < 1) {
      severity = { label: "Baixo", color: "text-emerald-600", desc: "Seus horários de sono são regulares. Isso é ótimo para a estabilidade do humor." };
    } else if (jetLagHours < 2) {
      severity = { label: "Moderado", color: "text-amber-600", desc: "Há alguma irregularidade entre dias úteis e fins de semana. Tente reduzir essa diferença gradualmente." };
    } else {
      severity = { label: "Alto", color: "text-red-600", desc: "Irregularidade significativa. Essa diferença pode afetar seu humor e energia. Converse com seu profissional." };
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="space-y-3 rounded-lg border border-border p-4 bg-surface">
          <h3 className="text-sm font-semibold text-foreground">Dias úteis (seg-sex)</h3>
          <div>
            <label htmlFor="weekBed" className="block text-xs text-muted mb-1">Horário de dormir</label>
            <input
              id="weekBed"
              type="time"
              value={weekBed}
              onChange={(e) => setWeekBed(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="weekWake" className="block text-xs text-muted mb-1">Horário de acordar</label>
            <input
              id="weekWake"
              type="time"
              value={weekWake}
              onChange={(e) => setWeekWake(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4 bg-surface">
          <h3 className="text-sm font-semibold text-foreground">Fins de semana (sáb-dom)</h3>
          <div>
            <label htmlFor="weekendBed" className="block text-xs text-muted mb-1">Horário de dormir</label>
            <input
              id="weekendBed"
              type="time"
              value={weekendBed}
              onChange={(e) => setWeekendBed(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="weekendWake" className="block text-xs text-muted mb-1">Horário de acordar</label>
            <input
              id="weekendWake"
              type="time"
              value={weekendWake}
              onChange={(e) => setWeekendWake(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <button
        onClick={calculate}
        className="w-full rounded-lg bg-primary px-6 py-3 font-medium text-white hover:bg-primary-dark"
      >
        Calcular
      </button>

      {result && severity && (
        <div className="rounded-lg border border-border bg-surface p-6 space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">Seu social jet lag</p>
            <p className="text-4xl font-bold text-foreground">
              {Math.floor(jetLagHours)}h{String(Math.round(result.jetLagMinutes % 60)).padStart(2, "0")}
            </p>
            <p className={`text-sm font-semibold mt-1 ${severity.color}`}>{severity.label}</p>
          </div>

          <p className="text-sm text-muted text-center">{severity.desc}</p>

          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-muted">Midpoint dias úteis</p>
              <p className="text-sm font-semibold">{minutesToTime(result.weekdayMidpoint)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Midpoint fins de semana</p>
              <p className="text-sm font-semibold">{minutesToTime(result.weekendMidpoint)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
