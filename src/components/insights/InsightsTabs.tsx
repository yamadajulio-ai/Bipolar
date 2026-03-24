"use client";

import { useState } from "react";

const TABS = [
  { key: "agora", label: "Agora", description: "Seu estado atual" },
  { key: "padroes", label: "Padrões", description: "Tendências e histórico" },
  { key: "avancado", label: "Avançado", description: "Análises e ferramentas" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function InsightsTabs({ children }: { children: [React.ReactNode, React.ReactNode, React.ReactNode] }) {
  const [active, setActive] = useState<TabKey>("agora");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex rounded-xl bg-surface-alt p-1" role="tablist" aria-label="Camadas de insights">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-all ${
              active === tab.key
                ? "bg-surface text-foreground shadow-sm dark:bg-card"
                : "text-muted hover:text-foreground/80"
            }`}
          >
            {tab.label}
            <span className="block text-[10px] font-normal opacity-70">{tab.description}</span>
          </button>
        ))}
      </div>

      {/* Panels */}
      {TABS.map((tab, i) => (
        <div
          key={tab.key}
          id={`panel-${tab.key}`}
          role="tabpanel"
          aria-labelledby={tab.key}
          hidden={active !== tab.key}
        >
          {children[i]}
        </div>
      ))}
    </div>
  );
}
