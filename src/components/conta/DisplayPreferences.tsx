"use client";

import { useState, useEffect } from "react";

const HIDE_KEYS = [
  { key: "sb_hide_streaks", label: "Contagem de dias (streaks)" },
  { key: "sb_hide_achievements", label: "Conquistas" },
] as const;

export function DisplayPreferences() {
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const hidden = HIDE_KEYS
      .filter(({ key }) => localStorage.getItem(key) === "1")
      .map(({ key }) => key);
    setHiddenItems(hidden);
    setLoaded(true);
  }, []);

  function handleRestore(key: string) {
    localStorage.removeItem(key);
    setHiddenItems((prev) => prev.filter((k) => k !== key));
  }

  if (!loaded) return null;
  if (hiddenItems.length === 0) return null;

  return (
    <div>
      <h2 className="mb-2 font-semibold">Exibição</h2>
      <p className="mb-3 text-sm text-muted">
        Você ocultou alguns elementos do dashboard. Restaure-os aqui:
      </p>
      <div className="space-y-2">
        {HIDE_KEYS.filter(({ key }) => hiddenItems.includes(key)).map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm text-muted">{label}</span>
            <button
              onClick={() => handleRestore(key)}
              className="rounded bg-primary px-3 py-1 text-xs text-white hover:bg-primary/90"
            >
              Mostrar novamente
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
