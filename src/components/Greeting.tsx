"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";

export function Greeting() {
  const [greeting, setGreeting] = useState("");
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">{greeting}</h1>
      {mounted && (
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-muted/20"
        >
          <span className="text-lg">{isDark ? "☀️" : "🌙"}</span>
          <span className="text-muted">{isDark ? "Modo claro" : "Modo escuro"}</span>
        </button>
      )}
    </div>
  );
}
