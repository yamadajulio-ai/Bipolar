"use client";

import { useState, useEffect, useCallback } from "react";

interface Prefs {
  hideStreaks: boolean;
  hideAchievements: boolean;
}

const PREF_LABELS: { key: keyof Prefs; label: string }[] = [
  { key: "hideStreaks", label: "Contagem de dias (streaks)" },
  { key: "hideAchievements", label: "Conquistas" },
];

export function DisplayPreferences() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);

  useEffect(() => {
    fetch("/api/display-preferences")
      .then((r) => r.json())
      .then((data: Prefs) => setPrefs(data))
      .catch(() => setPrefs({ hideStreaks: false, hideAchievements: false }));
  }, []);

  const handleRestore = useCallback(async (key: keyof Prefs) => {
    setPrefs((prev) => prev ? { ...prev, [key]: false } : prev);
    await fetch("/api/display-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: false }),
    });
  }, []);

  if (!prefs) return null;

  const hiddenItems = PREF_LABELS.filter(({ key }) => prefs[key]);
  if (hiddenItems.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 font-semibold">Exibição</h2>
      <p className="mb-3 text-sm text-muted">
        Você ocultou alguns elementos do dashboard. Restaure-os aqui:
      </p>
      <div className="space-y-2">
        {hiddenItems.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-muted">{label}</span>
            <button
              onClick={() => handleRestore(key)}
              className="rounded bg-primary px-3 py-1 min-h-[44px] text-xs text-white hover:bg-primary/90"
            >
              Mostrar novamente
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
