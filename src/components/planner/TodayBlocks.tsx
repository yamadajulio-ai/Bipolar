"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { CATEGORY_COLORS } from "@/lib/planner/categories";

interface SerializedBlock {
  id: string;
  title: string;
  category: string;
  kind: string;
  startAt: string;
  endAt: string;
  energyCost: number;
  stimulation: number;
  notes: string | null;
  recurrence: {
    freq: string;
    weekDays: string | null;
    until: string | null;
  } | null;
  exceptions: {
    occurrenceDate: string;
    isCancelled: boolean;
    overrideStartAt: string | null;
    overrideEndAt: string | null;
    overrideTitle: string | null;
  }[];
}

interface TodayBlocksProps {
  blocks: SerializedBlock[];
  today: string;
  targetSleepTimeMin: number | null;
}

interface DisplayBlock {
  id: string;
  title: string;
  category: string;
  kind: string;
  startAt: Date;
  endAt: Date;
  energyCost: number;
  isPast: boolean;
  isNext: boolean;
}

export function TodayBlocks({ blocks, today, targetSleepTimeMin }: TodayBlocksProps) {
  const [mountTime] = useState(() => Date.now());

  const displayBlocks = useMemo(() => {
    const now = new Date(mountTime);
    const result: DisplayBlock[] = [];

    for (const block of blocks) {
      const startAt = new Date(block.startAt);
      const endAt = new Date(block.endAt);
      const durationMs = endAt.getTime() - startAt.getTime();
      const rec = block.recurrence;

      // Build exception map
      const exMap = new Map<string, typeof block.exceptions[number]>();
      for (const ex of block.exceptions) {
        exMap.set(ex.occurrenceDate.split("T")[0], ex);
      }

      if (!rec || rec.freq === "NONE") {
        // Single block — check if it falls on today
        if (startAt.toISOString().split("T")[0] === today) {
          const ex = exMap.get(today);
          if (ex?.isCancelled) continue;
          result.push({
            id: block.id,
            title: ex?.overrideTitle || block.title,
            category: block.category,
            kind: block.kind,
            startAt: ex?.overrideStartAt ? new Date(ex.overrideStartAt) : startAt,
            endAt: ex?.overrideEndAt ? new Date(ex.overrideEndAt) : endAt,
            energyCost: block.energyCost,
            isPast: false,
            isNext: false,
          });
        }
        continue;
      }

      // Recurring: check if today matches
      const weekDaysSet = rec.weekDays ? new Set(rec.weekDays.split(",").map(Number)) : null;
      const todayDate = new Date(today + "T12:00:00");

      if (rec.until && new Date(rec.until) < todayDate) continue;
      if (startAt > todayDate) continue;

      let matches = false;
      if (rec.freq === "DAILY") matches = true;
      if (rec.freq === "WEEKLY") {
        if (weekDaysSet) {
          matches = weekDaysSet.has(todayDate.getDay());
        } else {
          matches = todayDate.getDay() === startAt.getDay();
        }
      }

      if (matches) {
        const ex = exMap.get(today);
        if (ex?.isCancelled) continue;

        const occStart = new Date(today + "T" + formatTime(startAt));
        const occEnd = new Date(occStart.getTime() + durationMs);

        result.push({
          id: block.id,
          title: ex?.overrideTitle || block.title,
          category: block.category,
          kind: block.kind,
          startAt: ex?.overrideStartAt ? new Date(ex.overrideStartAt) : occStart,
          endAt: ex?.overrideEndAt ? new Date(ex.overrideEndAt) : occEnd,
          energyCost: block.energyCost,
          isPast: false,
          isNext: false,
        });
      }
    }

    // Sort and mark past/next
    result.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    let nextFound = false;
    for (const b of result) {
      if (b.endAt < now) {
        b.isPast = true;
      } else if (!nextFound) {
        b.isNext = true;
        nextFound = true;
      }
    }

    return result;
  }, [blocks, today, mountTime]);

  // Energy budget
  const totalEnergy = displayBlocks.reduce((sum, b) => sum + b.energyCost, 0);

  // Time until next block
  const nextBlock = displayBlocks.find((b) => b.isNext);
  const minutesUntilNext = nextBlock
    ? Math.max(0, Math.round((nextBlock.startAt.getTime() - mountTime) / 60000))
    : null;

  return (
    <div className="space-y-3">
      {/* Energy budget bar */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted">Carga de energia do dia</span>
          <span className="text-sm font-bold text-foreground">{totalEnergy}</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full transition-all ${
              totalEnergy > 70 ? "bg-red-400" : totalEnergy > 40 ? "bg-amber-400" : "bg-green-400"
            }`}
            style={{ width: `${Math.min(100, totalEnergy)}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] text-muted">
          Soma dos custos de energia dos blocos. Valores altos podem exigir mais periodos de descanso.
        </p>
      </Card>

      {/* Next block highlight */}
      {nextBlock && (
        <Card className="border-primary/30 bg-primary/5">
          <p className="text-xs text-muted">Proximo</p>
          <p className="text-lg font-bold text-foreground">{nextBlock.title}</p>
          <p className="text-sm text-muted">
            {formatTimeDisplay(nextBlock.startAt)} — {formatTimeDisplay(nextBlock.endAt)}
            {minutesUntilNext !== null && minutesUntilNext > 0 && (
              <span className="ml-2 text-primary">em {minutesUntilNext} min</span>
            )}
          </p>
        </Card>
      )}

      {/* Block list */}
      {displayBlocks.length === 0 ? (
        <Card>
          <p className="text-center text-muted py-2">
            Nenhum bloco para hoje. Adicione no <a href="/planejador" className="text-primary hover:underline">planejador</a>.
          </p>
        </Card>
      ) : (
        displayBlocks.map((b) => {
          const colors = CATEGORY_COLORS[b.category] || CATEGORY_COLORS.outro;
          return (
            <div
              key={b.id + b.startAt.toISOString()}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-opacity ${colors} ${
                b.isPast ? "opacity-50" : ""
              } ${b.isNext ? "ring-2 ring-primary/30" : ""}`}
            >
              <div className="text-sm font-medium" style={{ minWidth: "5rem" }}>
                {formatTimeDisplay(b.startAt)} — {formatTimeDisplay(b.endAt)}
              </div>
              <div className="flex-1">
                <span className="font-medium">{b.title}</span>
                {b.kind === "ANCHOR" && <span className="ml-1 text-xs opacity-60">Ancora</span>}
              </div>
              <div className="text-xs text-muted">E:{b.energyCost}</div>
            </div>
          );
        })
      )}

      {/* Wind-down reminder */}
      {targetSleepTimeMin !== null && (
        <p className="text-center text-xs text-muted">
          Horario alvo de sono: {formatMinutes(targetSleepTimeMin)}
        </p>
      )}
    </div>
  );
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

function formatTimeDisplay(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
