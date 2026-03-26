"use client";
import { useState, useEffect } from "react";

const MARKS = [
  {
    key: "stability_score",
    title: "Score de Estabilidade",
    desc: "Sua pontuação de estabilidade combina sono, medicação, humor e estabilidade geral dos últimos 30 dias.",
  },
  {
    key: "mood_thermo",
    title: "Termômetro de Humor",
    desc: "Mostra sua tendência entre depressão e mania nas últimas 48h, ajudando a identificar mudanças cedo.",
  },
  {
    key: "safety_nudge",
    title: "Recursos de Segurança",
    desc: "Se detectarmos sinais de risco, mostramos recursos de apoio aqui \u2014 CVV 188, SAMU 192, CAPS.",
  },
  {
    key: "sos_button",
    title: "Botão SOS",
    desc: "Acesso rápido a recursos de crise e linhas de apoio 24h. Sempre disponível na parte inferior da tela.",
  },
];

const STORAGE_KEY = "coach-marks-seen";

export function CoachMarks() {
  const [dismissed, setDismissed] = useState(true);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setDismissed(false);
    } catch {
      // localStorage unavailable (private browsing, etc.)
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // silent
    }
    setDismissed(true);
  }

  const mark = MARKS[current];
  const isLast = current >= MARKS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-end justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dicas do painel"
    >
      <div className="bg-surface dark:bg-surface-raised rounded-[var(--radius-card)] p-5 max-w-sm w-full shadow-[var(--shadow-float)] space-y-3 animate-in slide-in-from-bottom-4 duration-300">
        <p className="font-semibold text-foreground">{mark.title}</p>
        <p className="text-sm text-muted">{mark.desc}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted" aria-live="polite">
            {current + 1} de {MARKS.length}
          </span>
          <div className="space-x-2">
            <button
              onClick={dismiss}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Pular
            </button>
            <button
              onClick={() => {
                if (!isLast) setCurrent(current + 1);
                else dismiss();
              }}
              className="text-sm font-medium text-primary dark:text-primary-light hover:text-primary-dark transition-colors"
            >
              {isLast ? "Entendi!" : "Próximo \u2192"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
