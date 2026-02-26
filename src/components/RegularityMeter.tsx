"use client";

interface RegularityMeterProps {
  value: number;
  label: string;
}

export function RegularityMeter({ value, label }: RegularityMeterProps) {
  const clamped = Math.max(0, Math.min(100, value));

  let barColor: string;
  if (clamped < 40) {
    barColor = "bg-danger";
  } else if (clamped <= 70) {
    barColor = "bg-warning";
  } else {
    barColor = "bg-success";
  }

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">{clamped}% de regularidade</p>
    </div>
  );
}
