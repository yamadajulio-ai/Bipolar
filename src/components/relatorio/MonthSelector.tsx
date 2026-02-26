"use client";

interface MonthSelectorProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-foreground">Mês:</label>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
      />
    </div>
  );
}
