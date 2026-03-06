"use client";

interface Props {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  /** If provided, draws a dashed reference line at this y value */
  baseline?: number;
  /** Min/max for y axis. If not provided, auto-scales */
  min?: number;
  max?: number;
}

/**
 * Minimal sparkline SVG chart — no dependencies needed.
 * Renders a small inline line chart for showing trends at a glance.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#22c55e",
  baseline,
  min: forceMin,
  max: forceMax,
}: Props) {
  const values = data.filter((v): v is number => v !== null);
  if (values.length < 2) return null;

  const minVal = forceMin ?? Math.min(...values);
  const maxVal = forceMax ?? Math.max(...values);
  const range = maxVal - minVal || 1;
  const padding = 2;

  // Map values to SVG coordinates
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== null) {
      const x = padding + ((i / Math.max(1, data.length - 1)) * (width - padding * 2));
      const y = height - padding - ((data[i]! - minVal) / range) * (height - padding * 2);
      points.push({ x, y });
    }
  }

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  // Last point highlight
  const lastPoint = points[points.length - 1];

  // Baseline — only draw if within visible range
  let baselineY: number | null = null;
  if (baseline !== undefined && baseline >= minVal && baseline <= maxVal) {
    baselineY = height - padding - ((baseline - minVal) / range) * (height - padding * 2);
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
      aria-hidden="true"
    >
      {/* Baseline reference */}
      {baselineY !== null && (
        <line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke={color}
          strokeWidth={0.5}
          strokeDasharray="2,2"
          opacity={0.3}
        />
      )}
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      {lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill={color} />
      )}
    </svg>
  );
}
