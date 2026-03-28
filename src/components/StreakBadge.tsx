"use client";

import { useCallback } from "react";

interface StreakBadgeProps {
  checkinStreak: number;
  sleepStreak: number;
  bestCheckinStreak: number;
  hidden?: boolean;
  onToggleHide?: (hide: boolean) => void;
}

export function StreakBadge({ checkinStreak, sleepStreak, bestCheckinStreak, hidden, onToggleHide }: StreakBadgeProps) {
  const handleHide = useCallback(() => {
    onToggleHide?.(true);
  }, [onToggleHide]);

  if (hidden) return null;
  if (checkinStreak === 0 && sleepStreak === 0) return null;

  return (
    <div className="flex items-center gap-4">
      {checkinStreak > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5">
          <span className="text-lg" role="img" aria-label="Dias de check-in">
            {checkinStreak >= 30 ? "⭐" : checkinStreak >= 14 ? "🧭" : checkinStreak >= 7 ? "🌿" : "📊"}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-primary leading-tight">
              {checkinStreak} {checkinStreak === 1 ? "dia" : "dias"}
            </span>
            <span className="text-[11px] text-muted leading-tight">de acompanhamento</span>
          </div>
          {bestCheckinStreak > checkinStreak && (
            <span className="text-[11px] text-muted">
              (melhor: {bestCheckinStreak})
            </span>
          )}
        </div>
      )}

      {sleepStreak > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-indigo-500/10 px-3.5 py-1.5">
          <span className="text-lg" role="img" aria-label="Dias de sono registrado">🌙</span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
              {sleepStreak} {sleepStreak === 1 ? "dia" : "dias"}
            </span>
            <span className="text-[11px] text-muted leading-tight">sono registrado</span>
          </div>
        </div>
      )}

      <button
        onClick={handleHide}
        className="ml-auto text-[11px] text-muted hover:text-foreground min-h-11 min-w-11 flex items-center justify-center"
        aria-label="Esconder contagem de dias"
        title="Esconder"
      >
        &#10005;
      </button>
    </div>
  );
}

/* Note: StreakBadge is placed BELOW all clinical alerts in the dashboard.
   It frames consistency as a health tool, not a game. Crisis mode hides it entirely.
   Per audit: gamification never above clinical alerts. */
