"use client";

interface StreakBadgeProps {
  checkinStreak: number;
  sleepStreak: number;
  bestCheckinStreak: number;
}

export function StreakBadge({ checkinStreak, sleepStreak, bestCheckinStreak }: StreakBadgeProps) {
  if (checkinStreak === 0 && sleepStreak === 0) return null;

  const fireLevel = checkinStreak >= 30 ? 3 : checkinStreak >= 14 ? 2 : checkinStreak >= 7 ? 1 : 0;

  return (
    <div className="flex items-center gap-4">
      {checkinStreak > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5">
          <span className="text-lg" role="img" aria-label="Streak de check-in">
            {fireLevel >= 3 ? "🔥🏆" : fireLevel >= 2 ? "🔥💪" : fireLevel >= 1 ? "🔥⭐" : "🔥"}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-primary leading-tight">
              {checkinStreak} {checkinStreak === 1 ? "dia" : "dias"}
            </span>
            <span className="text-[10px] text-muted leading-tight">check-in seguidos</span>
          </div>
          {bestCheckinStreak > checkinStreak && (
            <span className="text-[10px] text-muted">
              (recorde: {bestCheckinStreak})
            </span>
          )}
        </div>
      )}

      {sleepStreak > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-indigo-500/10 px-3.5 py-1.5">
          <span className="text-lg" role="img" aria-label="Streak de sono">🌙</span>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 leading-tight">
              {sleepStreak} {sleepStreak === 1 ? "dia" : "dias"}
            </span>
            <span className="text-[10px] text-muted leading-tight">sono registrado</span>
          </div>
        </div>
      )}
    </div>
  );
}
