"use client";

import { useState, useEffect } from "react";
import type { Achievement } from "@/lib/streaks";

interface AchievementGridProps {
  achievements: Achievement[];
}

const HIDE_KEY = "sb_hide_achievements";

export function AchievementGrid({ achievements }: AchievementGridProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(HIDE_KEY) === "1") {
      setHidden(true);
    }
  }, []);

  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  if (unlocked.length === 0 && locked.length === 0) return null;

  if (hidden) {
    return (
      <button
        onClick={() => { localStorage.removeItem(HIDE_KEY); setHidden(false); }}
        className="w-full text-center text-[10px] text-muted hover:text-foreground py-1"
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
          onClick={() => { localStorage.setItem(HIDE_KEY, "1"); setHidden(true); }}
          className="text-[10px] text-muted hover:text-foreground"
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
