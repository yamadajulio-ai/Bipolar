"use client";

import type { Achievement } from "@/lib/streaks";

interface AchievementGridProps {
  achievements: Achievement[];
}

export function AchievementGrid({ achievements }: AchievementGridProps) {
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  if (unlocked.length === 0 && locked.length === 0) return null;

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-foreground">Conquistas</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {unlocked.map((a) => (
          <div
            key={a.key}
            className="flex flex-col items-center rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-center"
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="mt-1 text-[11px] font-semibold text-foreground leading-tight">{a.label}</span>
            <span className="text-[9px] text-muted leading-tight">{a.description}</span>
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
              <div className="mt-1 h-1 w-full rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-primary/50"
                  style={{ width: `${Math.round(a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
