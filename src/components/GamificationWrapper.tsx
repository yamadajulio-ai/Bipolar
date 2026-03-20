"use client";

import { useState, useCallback } from "react";
import { StreakBadge } from "@/components/StreakBadge";
import { AchievementGrid } from "@/components/AchievementGrid";
import type { Achievement } from "@/lib/streaks";

interface GamificationWrapperProps {
  checkinStreak: number;
  sleepStreak: number;
  bestCheckinStreak: number;
  achievements: Achievement[];
  initialHideStreaks: boolean;
  initialHideAchievements: boolean;
}

export function GamificationWrapper({
  checkinStreak,
  sleepStreak,
  bestCheckinStreak,
  achievements,
  initialHideStreaks,
  initialHideAchievements,
}: GamificationWrapperProps) {
  const [hideStreaks, setHideStreaks] = useState(initialHideStreaks);
  const [hideAchievements, setHideAchievements] = useState(initialHideAchievements);

  const updatePrefs = useCallback(async (data: { hideStreaks?: boolean; hideAchievements?: boolean }) => {
    await fetch("/api/display-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }, []);

  const handleToggleStreaks = useCallback((hide: boolean) => {
    setHideStreaks(hide);
    updatePrefs({ hideStreaks: hide });
  }, [updatePrefs]);

  const handleToggleAchievements = useCallback((hide: boolean) => {
    setHideAchievements(hide);
    updatePrefs({ hideAchievements: hide });
  }, [updatePrefs]);

  const hasStreaks = checkinStreak > 0 || sleepStreak > 0;
  const hasUnlocked = achievements.some((a) => a.unlocked);

  return (
    <>
      {hasStreaks && (
        <div className="mt-3 pt-3 border-t border-border">
          <StreakBadge
            checkinStreak={checkinStreak}
            sleepStreak={sleepStreak}
            bestCheckinStreak={bestCheckinStreak}
            hidden={hideStreaks}
            onToggleHide={handleToggleStreaks}
          />
        </div>
      )}
      {hasUnlocked && (
        <div className="mt-3 pt-3 border-t border-border">
          <AchievementGrid
            achievements={achievements}
            hidden={hideAchievements}
            onToggleHide={handleToggleAchievements}
          />
        </div>
      )}
    </>
  );
}
