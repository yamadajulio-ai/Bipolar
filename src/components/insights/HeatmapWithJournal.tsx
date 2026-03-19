"use client";

import { useState } from "react";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { Card } from "@/components/Card";
import type { HeatmapDay } from "@/lib/insights/computeInsights";

// ── Types ────────────────────────────────────────────────────

interface DiaryData {
  date: string;
  mood: number;
  energyLevel: number | null;
  anxietyLevel: number | null;
  irritability: number | null;
  sleepHours: number;
  tookMedication: string | null;
  note: string | null;
}

interface JournalData {
  id: string;
  type: string;
  content: string;
  zoneAtCapture: string | null;
  mixedAtCapture: boolean | null;
  snapshotSource: string;
  createdAt: string;
}

interface Props {
  heatmapData: HeatmapDay[];
  diaryEntries: DiaryData[];
  journalEntries: JournalData[];
}

// ── Zone labels ──────────────────────────────────────────────

const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  depressao: { label: "Humor muito baixo", color: "text-blue-800" },
  depressao_leve: { label: "Humor baixo", color: "text-blue-700" },
  eutimia: { label: "Humor estável", color: "text-emerald-800" },
  hipomania: { label: "Humor elevado", color: "text-amber-800" },
  mania: { label: "Humor muito elevado", color: "text-red-800" },
};

const MOOD_LABELS: Record<number, string> = {
  1: "Muito deprimido",
  2: "Deprimido",
  3: "Estável",
  4: "Elevado",
  5: "Muito elevado",
};

const ENERGY_LABELS: Record<number, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Normal",
  4: "Alta",
  5: "Muito alta",
};

// ── Component ────────────────────────────────────────────────

export function HeatmapWithJournal({ heatmapData, diaryEntries, journalEntries }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Index data by date for O(1) lookup
  const diaryByDate = new Map(diaryEntries.map((e) => [e.date, e]));
  const journalByDate = new Map<string, JournalData[]>();
  for (const j of journalEntries) {
    const dateKey = j.createdAt.slice(0, 10); // YYYY-MM-DD from ISO string
    if (!journalByDate.has(dateKey)) journalByDate.set(dateKey, []);
    journalByDate.get(dateKey)!.push(j);
  }

  const handleDaySelect = (date: string) => {
    setSelectedDate((prev) => (prev === date ? null : date));
  };

  const diary = selectedDate ? diaryByDate.get(selectedDate) : null;
  const journals = selectedDate ? journalByDate.get(selectedDate) ?? [] : [];

  return (
    <div>
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Visão geral — 90 dias</h2>
        <p className="mb-4 text-[11px] text-muted">
          Toque em um dia para ver o que você registrou e escreveu naquele momento.
        </p>
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground/70">
              Humor (1=deprimido, 3=estável, 5=elevado)
            </p>
            <CalendarHeatmap
              data={heatmapData}
              metric="mood"
              onDaySelect={handleDaySelect}
              selectedDate={selectedDate}
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-foreground/70">
              Sono (verde=7-9h ideal, vermelho=pouco, azul=excesso)
            </p>
            <CalendarHeatmap
              data={heatmapData}
              metric="sleep"
              onDaySelect={handleDaySelect}
              selectedDate={selectedDate}
            />
          </div>
        </div>
      </Card>

      {/* Day Detail Panel */}
      {selectedDate && (diary || journals.length > 0) && (
        <Card className="mt-3 border-primary/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {formatDateHeader(selectedDate)}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-muted hover:text-foreground"
              aria-label="Fechar detalhes do dia"
            >
              Fechar
            </button>
          </div>

          {/* Check-in summary */}
          {diary && (
            <div className="mb-3 rounded-lg bg-surface-alt p-3">
              <p className="text-[10px] font-medium text-muted uppercase tracking-wide mb-2">
                Check-in do dia
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted">Humor:</span>{" "}
                  <span className="font-medium">{MOOD_LABELS[diary.mood] ?? diary.mood}</span>
                </div>
                <div>
                  <span className="text-xs text-muted">Energia:</span>{" "}
                  <span className="font-medium">
                    {diary.energyLevel ? ENERGY_LABELS[diary.energyLevel] ?? diary.energyLevel : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted">Sono:</span>{" "}
                  <span className="font-medium">{formatSleep(diary.sleepHours)}</span>
                </div>
                <div>
                  <span className="text-xs text-muted">Medicação:</span>{" "}
                  <span className={`font-medium ${
                    diary.tookMedication === "sim" ? "text-emerald-700" :
                    diary.tookMedication === "nao" ? "text-red-600" : "text-amber-600"
                  }`}>
                    {diary.tookMedication === "sim" ? "Sim" :
                     diary.tookMedication === "nao" ? "Não" : "Ainda não"}
                  </span>
                </div>
              </div>
              {diary.note && (
                <p className="mt-2 text-xs text-muted italic border-t border-border pt-2">
                  &ldquo;{diary.note}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Journal entries for this day */}
          {journals.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted uppercase tracking-wide mb-2">
                Diário — o que você escreveu
              </p>
              <div className="space-y-2">
                {journals.map((j) => (
                  <div key={j.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          j.type === "DIARY"
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {j.type === "DIARY" ? "Diário" : "Insight"}
                      </span>
                      {j.zoneAtCapture && j.snapshotSource === "RECENT_CHECKIN" && (
                        <span className={`text-[10px] ${ZONE_LABELS[j.zoneAtCapture]?.color ?? "text-muted"}`}>
                          {ZONE_LABELS[j.zoneAtCapture]?.label ?? j.zoneAtCapture}
                        </span>
                      )}
                      <span className="text-[10px] text-muted ml-auto">
                        {formatTime(j.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {j.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No journal entries for this day */}
          {journals.length === 0 && diary && (
            <div className="text-center py-2">
              <p className="text-xs text-muted">
                Nenhuma entrada do diário neste dia.
              </p>
              <a
                href="/meu-diario"
                className="text-xs text-primary hover:underline"
              >
                Escrever agora
              </a>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatDateHeader(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatSleep(hours: number): string {
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatTime(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return "";
  }
}
