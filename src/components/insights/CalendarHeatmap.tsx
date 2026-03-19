"use client";

import { useState } from "react";
import type { HeatmapDay } from "@/lib/insights/computeInsights";

interface Props {
  data: HeatmapDay[];
  metric: "mood" | "sleep" | "energy";
  onDaySelect?: (date: string) => void;
  selectedDate?: string | null;
}

const MOOD_COLORS: Record<number, string> = {
  1: "bg-blue-600",
  2: "bg-blue-300",
  3: "bg-emerald-400",
  4: "bg-amber-400",
  5: "bg-red-400",
};

function getSleepColor(hours: number | null): string {
  if (hours === null) return "bg-black/10";
  if (hours < 5) return "bg-red-500";
  if (hours < 6) return "bg-red-300";
  if (hours < 7) return "bg-amber-300";
  if (hours <= 9) return "bg-emerald-400";
  if (hours <= 10) return "bg-amber-300";
  return "bg-blue-400";
}

function getEnergyColor(energy: number | null): string {
  if (energy === null) return "bg-black/10";
  return MOOD_COLORS[energy] || "bg-black/10";
}

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function CalendarHeatmap({ data, metric, onDaySelect, selectedDate }: Props) {
  const [tooltip, setTooltip] = useState<{ day: HeatmapDay; x: number; y: number } | null>(null);

  if (data.length === 0) return null;

  // Organize into weeks (columns) starting from Sunday
  const firstDate = new Date(data[0].date + "T12:00:00");
  const firstDow = firstDate.getDay(); // 0=Sun
  const paddedStart: (HeatmapDay | null)[] = Array(firstDow).fill(null);
  const allDays = [...paddedStart, ...data];

  // Split into weeks
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  // Pad last week if needed
  const lastWeek = weeks[weeks.length - 1];
  while (lastWeek.length < 7) lastWeek.push(null);

  function getCellColor(day: HeatmapDay | null): string {
    if (!day || !day.hasEntry) return "bg-black/8";
    if (metric === "mood") return day.mood !== null ? (MOOD_COLORS[day.mood] || "bg-gray-800/30") : "bg-black/8";
    if (metric === "sleep") return getSleepColor(day.sleepHours);
    return getEnergyColor(day.energy);
  }

  function getTooltipText(day: HeatmapDay): string {
    const dateObj = new Date(day.date + "T12:00:00Z");
    const dateStr = dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", weekday: "short", timeZone: "UTC" });
    const parts = [dateStr];
    if (day.mood !== null) parts.push(`Humor: ${day.mood}`);
    if (day.sleepHours !== null) {
      const totalMin = Math.round(day.sleepHours * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      parts.push(`Sono: ${h}h${m > 0 ? String(m).padStart(2, "0") : ""}`);
    }
    if (day.energy !== null) parts.push(`Energia: ${day.energy}`);
    return parts.join(" · ");
  }

  // Month labels
  const monthLabels: { text: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIdx) => {
    for (const day of week) {
      if (!day) continue;
      const month = parseInt(day.date.slice(5, 7), 10);
      if (month !== lastMonth) {
        const names = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        monthLabels.push({ text: names[month], weekIdx });
        lastMonth = month;
        break;
      }
    }
  });

  return (
    <div className="relative">
      {/* Month labels */}
      <div className="mb-1 flex" style={{ paddingLeft: "20px" }}>
        {monthLabels.map(({ text, weekIdx }, i) => (
          <span
            key={i}
            className="text-[9px] text-muted"
            style={{ position: "absolute", left: `${20 + weekIdx * 14}px` }}
          >
            {text}
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-0.5">
        {/* Weekday labels */}
        <div className="flex flex-col gap-0.5 pr-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="flex h-[12px] w-[14px] items-center justify-center text-[8px] text-muted">
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                role={day?.hasEntry ? "button" : undefined}
                tabIndex={day?.hasEntry ? 0 : undefined}
                aria-label={day?.hasEntry ? getTooltipText(day) : undefined}
                className={`h-[12px] w-[12px] rounded-sm ${getCellColor(day)} ${
                  day?.hasEntry ? "cursor-pointer hover:ring-1 hover:ring-foreground/30 focus:ring-1 focus:ring-foreground/30 focus:outline-none" : ""
                } ${day && selectedDate === day.date ? "ring-2 ring-primary" : ""}`}
                onMouseEnter={(e) => {
                  if (day?.hasEntry) {
                    setTooltip({ day, x: e.clientX, y: e.clientY });
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={(e) => {
                  if (day?.hasEntry) {
                    setTooltip((prev) => prev?.day === day ? null : { day, x: e.clientX, y: e.clientY });
                    if (onDaySelect) onDaySelect(day.date);
                  }
                }}
                onKeyDown={(e) => {
                  if (!day?.hasEntry) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip((prev) =>
                      prev?.day === day ? null : { day, x: rect.left + 6, y: rect.top }
                    );
                  }
                }}
                onFocus={(e) => {
                  if (day?.hasEntry) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltip({ day, x: rect.left + 6, y: rect.top });
                  }
                }}
                onBlur={() => setTooltip(null)}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-2 text-[9px] text-muted" aria-label={metric === "mood" ? "Legenda: humor de 1 (baixo) a 5 (alto)" : "Legenda: sono de menos de 5h a mais de 10h"}>
        {metric === "mood" && (
          <>
            <span>Baixo</span>
            <div className="flex gap-0.5" role="img" aria-label="Escala de cores: deprimido (azul) a eufórico (vermelho)">
              {[1, 2, 3, 4, 5].map((v) => (
                <div key={v} className={`h-[10px] w-[10px] rounded-sm ${MOOD_COLORS[v]}`} aria-hidden="true" />
              ))}
            </div>
            <span>Alto</span>
          </>
        )}
        {metric === "sleep" && (
          <>
            <span>&lt;5h</span>
            <div className="flex gap-0.5" role="img" aria-label="Escala de cores: pouco sono (vermelho) a muito sono (azul)">
              <div className="h-[10px] w-[10px] rounded-sm bg-red-500" aria-hidden="true" />
              <div className="h-[10px] w-[10px] rounded-sm bg-red-300" aria-hidden="true" />
              <div className="h-[10px] w-[10px] rounded-sm bg-amber-300" aria-hidden="true" />
              <div className="h-[10px] w-[10px] rounded-sm bg-emerald-400" aria-hidden="true" />
              <div className="h-[10px] w-[10px] rounded-sm bg-blue-400" aria-hidden="true" />
            </div>
            <span>&gt;10h</span>
          </>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{ left: tooltip.x + 12, top: tooltip.y - 30 }}
        >
          {getTooltipText(tooltip.day)}
        </div>
      )}
    </div>
  );
}
