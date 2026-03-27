"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { CATEGORY_COLORS, GOOGLE_EVENT_COLORS } from "@/lib/planner/categories";
import { expandSerializedBlocks } from "@/lib/planner/expandClient";
import type { SerializedBlock } from "@/lib/planner/expandClient";

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
  googleColor?: string | null;
  isPast: boolean;
  isNext: boolean;
}

export function TodayBlocks({ blocks, today, targetSleepTimeMin }: TodayBlocksProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Update "now" every 30 seconds so countdown/past status stays fresh
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const displayBlocks = useMemo(() => {
    const now = new Date(nowMs);
    const rangeStart = new Date(today + "T00:00:00");
    const rangeEnd = new Date(today + "T23:59:59");

    const expanded = expandSerializedBlocks(blocks, rangeStart, rangeEnd);

    const result: DisplayBlock[] = expanded.map((occ) => ({
      id: occ.blockId,
      title: occ.title,
      category: occ.category,
      kind: occ.kind,
      startAt: occ.startAt instanceof Date ? occ.startAt : new Date(occ.startAt),
      endAt: occ.endAt instanceof Date ? occ.endAt : new Date(occ.endAt),
      energyCost: occ.energyCost,
      googleColor: occ.googleColor,
      isPast: false,
      isNext: false,
    }));

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
  }, [blocks, today, nowMs]);

  // Energy budget
  const totalEnergy = displayBlocks.reduce((sum, b) => sum + b.energyCost, 0);

  // Time until next block
  const nextBlock = displayBlocks.find((b) => b.isNext);
  const minutesUntilNext = nextBlock
    ? Math.max(0, Math.round((nextBlock.startAt.getTime() - nowMs) / 60000))
    : null;

  return (
    <div className="space-y-3">
      {/* Energy budget bar */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted">Carga de energia do dia</span>
          <span className="text-sm font-bold text-foreground">{totalEnergy}</span>
        </div>
        <div className="h-2 rounded-full bg-border">
          <div
            className={`h-2 rounded-full transition-all ${
              totalEnergy > 70 ? "bg-red-400" : totalEnergy > 40 ? "bg-amber-400" : "bg-green-400"
            }`}
            style={{ width: `${Math.min(100, totalEnergy)}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Soma dos custos de energia dos blocos. Valores altos podem exigir mais periodos de descanso.
        </p>
      </Card>

      {/* Next block highlight */}
      {nextBlock && (
        <Card className="border-primary/30 bg-primary/5">
          <p className="text-xs text-muted">Próximo</p>
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
            Sua agenda de hoje está vazia. Organize seu dia na <a href="/agenda-rotina" className="text-primary hover:underline">agenda</a> para manter a rotina.
          </p>
        </Card>
      ) : (
        displayBlocks.map((b) => {
          const gColor = b.googleColor ? GOOGLE_EVENT_COLORS[b.googleColor] : null;
          const categoryClasses = !gColor ? (CATEGORY_COLORS[b.category] || CATEGORY_COLORS.outro) : "";
          return (
            <div
              key={b.id + b.startAt.toISOString()}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-opacity ${categoryClasses} ${
                b.isPast ? "opacity-50" : ""
              } ${b.isNext ? "ring-2 ring-primary/30" : ""}`}
              style={gColor ? { backgroundColor: gColor.bg, borderColor: gColor.border, color: gColor.text } : undefined}
            >
              <div className="text-sm font-medium" style={{ minWidth: "5rem" }}>
                {formatTimeDisplay(b.startAt)} — {formatTimeDisplay(b.endAt)}
              </div>
              <div className="flex-1">
                <span className="font-medium">{b.title}</span>
                {b.kind === "ANCHOR" && <span className="ml-1 text-xs opacity-60">Âncora</span>}
              </div>
              <div className="text-xs text-muted">E:{b.energyCost}</div>
            </div>
          );
        })
      )}

      {/* Wind-down reminder */}
      {targetSleepTimeMin !== null && (
        <p className="text-center text-xs text-muted">
          Horário alvo de sono: {formatMinutes(targetSleepTimeMin)}
        </p>
      )}
    </div>
  );
}

function formatTimeDisplay(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
