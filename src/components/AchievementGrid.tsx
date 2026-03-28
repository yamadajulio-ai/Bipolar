"use client";

import { useCallback } from "react";
import type { Achievement } from "@/lib/streaks";

interface AchievementGridProps {
  achievements: Achievement[];
  hidden?: boolean;
  onToggleHide?: (hide: boolean) => void;
}

export function AchievementGrid({ achievements, hidden, onToggleHide }: AchievementGridProps) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  const handleHide = useCallback(() => onToggleHide?.(true), [onToggleHide]);
  const handleShow = useCallback(() => onToggleHide?.(false), [onToggleHide]);

  if (unlocked.length === 0 && locked.length === 0) return null;

  if (hidden) {
    return (
      <button
        onClick={handleShow}
        className="w-full text-center text-[11px] text-muted hover:text-foreground min-h-11 py-2"
        aria-label="Mostrar conquistas"
      >
        Mostrar conquistas
      </button>
    );
  }

  return (
    <section aria-label="Conquistas">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Conquistas</h3>
        <button
          onClick={handleHide}
          className="text-[11px] text-muted hover:text-foreground min-h-11 px-2 py-2"
          aria-label="Esconder conquistas"
        >
          Esconder
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {unlocked.map((a) => (
          <div
            key={a.key}
            className="flex flex-col items-center rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-center"
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="mt-1 text-[11px] font-semibold text-foreground leading-tight">{a.label}</span>
            <span className="text-[11px] text-muted leading-tight">{a.description}</span>
          </div>
        ))}
        {locked.slice(0, 4 - (unlocked.length % 4 === 0 ? 0 : unlocked.length % 4)).map((a) => (
          <div
            key={a.key}
            className="flex flex-col items-center rounded-lg border border-border bg-surface p-2.5 text-center opacity-40"
          >
            <span className="text-2xl grayscale">{a.icon}</span>
            <span className="mt-1 text-[11px] font-semibold text-foreground leading-tight">{a.label}</span>
            {a.progress !== undefined && a.target !== undefined && (
              <div
                className="mt-1 h-1 w-full rounded-full bg-border"
                role="progressbar"
                aria-valuenow={Math.round(a.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${a.label}: ${Math.round(a.progress * 100)}%`}
              >
                <div
                  className="h-full rounded-full bg-primary/50"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
