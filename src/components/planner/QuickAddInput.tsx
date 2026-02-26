"use client";

import { useState } from "react";

interface QuickAddInputProps {
  contextDate: string; // YYYY-MM-DD
  onCreated: () => void;
  onPartialParse: (parsed: Record<string, unknown>) => void;
}

export function QuickAddInput({ contextDate, onCreated, onPartialParse }: QuickAddInputProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, contextDate }),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.created) {
        setText("");
        onCreated();
      } else if (data.parsed) {
        onPartialParse(data.parsed);
        setText("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Ex: "amanha 14-15 reuniao"'
        disabled={loading}
        className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "..." : "Adicionar"}
      </button>
    </form>
  );
}
