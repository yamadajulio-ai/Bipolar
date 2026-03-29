"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";

const OPTIONS = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Automático" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  if (!mounted) {
    return (
      <div>
        <h2 className="mb-2 font-semibold">Aparência</h2>
        <p className="mb-3 text-sm text-muted">Escolha o tema visual do aplicativo.</p>
        <div className="flex gap-2">
          {OPTIONS.map((opt) => (
            <span
              key={opt.value}
              className="rounded-lg border border-border px-4 py-3 text-sm text-muted"
            >
              {opt.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-2 font-semibold">Aparência</h2>
      <p className="mb-3 text-sm text-muted">Escolha o tema visual do aplicativo.</p>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors min-h-11 ${
              theme === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:border-primary/50"
            }`}
            aria-pressed={theme === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
