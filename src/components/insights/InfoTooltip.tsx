"use client";

import { useState, useRef, useEffect, useId, useCallback } from "react";

interface Props {
  title: string;
  content: string;
  tip?: string; // optional "como melhorar" tip
}

export function InfoTooltip({ title, content, tip }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

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

  const handleMouseEnter = useCallback(() => {
    hoverTimeout.current = setTimeout(() => setOpen(true), 200);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setOpen(false), 300);
  }, []);

  return (
    <div
      className="relative inline-block"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-[10px] font-bold text-muted hover:bg-black/20"
        aria-label={`Informações sobre ${title}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
      >
        ?
      </button>
      {open && (
        <div id={tooltipId} role="tooltip" className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 shadow-lg">
          <p className="mb-1 text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[11px] leading-relaxed text-foreground/60">{content}</p>
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
