"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  title: string;
  content: string;
  tip?: string; // optional "como melhorar" tip
}

export function InfoTooltip({ title, content, tip }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold text-muted hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
        aria-label={`Informações sobre ${title}`}
      >
        ?
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="mb-1 text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] leading-relaxed text-muted">{content}</p>
          {tip && (
            <p className="mt-2 text-[11px] leading-relaxed text-primary">
              <span className="font-medium">Como melhorar:</span> {tip}
            </p>
          )}
          <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l border-t border-border bg-surface" />
        </div>
      )}
    </div>
  );
}
