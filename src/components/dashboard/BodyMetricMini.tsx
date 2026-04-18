import clsx from "clsx";

interface Props {
  /** Today's value (or most recent non-null in `series7d`). Null → card hidden upstream. */
  value: number;
  /** Human label under the number: "passos hoje", "ms HRV hoje", "bpm hoje" */
  label: string;
  /** 7 entries chronological (oldest → today); null = gap/missing data */
  series7d: (number | null)[];
  /** Mean over 30 days for trend baseline. Null = insufficient baseline data. */
  baseline30d: number | null;
  /** Formatter for the big number (e.g. Intl locale thousands). */
  formatValue: (v: number) => string;
  /** Tailwind color tokens for the accent. */
  tone: "steps" | "hrv" | "hr";
  /** True if today's value is missing; we're showing yesterday as fallback. */
  fallbackDay?: boolean;
}

const TONE = {
  steps: {
    bg: "bg-info-bg-subtle/70",
    fg: "text-info-fg",
    accent: "fill-info-fg/80",
    gap: "fill-info-fg/15",
  },
  hrv: {
    bg: "bg-primary/10",
    fg: "text-primary",
    accent: "fill-primary/80",
    gap: "fill-primary/15",
  },
  hr: {
    bg: "bg-danger-bg-subtle/70",
    fg: "text-danger-fg",
    accent: "fill-danger-fg/80",
    gap: "fill-danger-fg/15",
  },
} as const;

/** Decide if trend is "higher", "lower" or "flat" relative to the 30d mean. */
function trendFromBaseline(today: number, baseline: number): {
  arrow: "↑" | "↓" | "→";
  pct: number;
  sign: "up" | "down" | "flat";
} {
  if (baseline <= 0) return { arrow: "→", pct: 0, sign: "flat" };
  const pct = Math.round(((today - baseline) / baseline) * 100);
  if (Math.abs(pct) < 5) return { arrow: "→", pct: 0, sign: "flat" };
  return pct > 0
    ? { arrow: "↑", pct, sign: "up" }
    : { arrow: "↓", pct: Math.abs(pct), sign: "down" };
}

export function BodyMetricMini({
  value,
  label,
  series7d,
  baseline30d,
  formatValue,
  tone,
  fallbackDay = false,
}: Props) {
  const t = TONE[tone];

  // Sparkline geometry — 7 bars, fixed dims
  const W = 78;
  const H = 18;
  const BAR_W = 9;
  const GAP = 2;
  const nonNull = series7d.filter((v): v is number => v !== null && v > 0);
  const maxVal = nonNull.length > 0 ? Math.max(...nonNull) : 1;

  // Trend vs 30d baseline — only show when baseline is statistically meaningful
  const showTrend = baseline30d !== null && baseline30d > 0 && series7d.filter((v) => v !== null).length >= 3;
  const trend = showTrend ? trendFromBaseline(value, baseline30d) : null;

  return (
    <div className={clsx("rounded-lg p-2", t.bg)}>
      <p className={clsx("text-base font-semibold", t.fg)}>{formatValue(value)}</p>
      <p className={clsx("text-[11px]", t.fg, "opacity-80")}>
        {fallbackDay ? label.replace(" hoje", " ontem") : label}
      </p>

      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1.5 block"
        role="img"
        aria-label={`Últimos 7 dias de ${label}`}
      >
        {series7d.map((v, i) => {
          const x = i * (BAR_W + GAP);
          if (v === null || v <= 0) {
            // Gap marker — low flat bar so user sees "sem dado nesse dia"
            return (
              <rect
                key={i}
                x={x}
                y={H - 2}
                width={BAR_W}
                height={2}
                className={t.gap}
                rx={1}
              />
            );
          }
          const h = Math.max(2, Math.round((v / maxVal) * (H - 2)));
          const y = H - h;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={BAR_W}
              height={h}
              className={t.accent}
              rx={1}
            />
          );
        })}
      </svg>

      {trend && (
        <p className={clsx("text-[10px] mt-0.5", t.fg, "opacity-70")}>
          {trend.arrow}{" "}
          {trend.sign === "flat"
            ? "estável"
            : `${trend.pct}% vs 30d`}
        </p>
      )}
    </div>
  );
}
