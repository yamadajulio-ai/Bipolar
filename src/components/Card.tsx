import { clsx } from "clsx";

type CardVariant = "surface" | "raised" | "hero" | "interactive";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  surface: clsx(
    "rounded-[var(--radius-card)] border border-border",
    "bg-surface shadow-[var(--shadow-card)]",
  ),
  raised: clsx(
    "relative overflow-hidden rounded-[var(--radius-card)] border border-border-soft",
    "bg-surface-raised shadow-[var(--shadow-raised)]",
    "dark:border-border-strong",
  ),
  hero: clsx(
    "relative overflow-hidden rounded-[var(--radius-panel)] border border-border-soft",
    "bg-surface-raised shadow-[var(--shadow-raised)]",
    "dark:border-border-strong",
  ),
  interactive: clsx(
    "relative overflow-hidden rounded-[var(--radius-card)] border border-border-soft",
    "bg-surface shadow-[var(--shadow-card)]",
    "dark:border-border-strong",
    "transition-[transform,box-shadow] duration-200",
    "hover:-translate-y-px hover:shadow-[var(--shadow-raised)]",
    "active:scale-[0.985] active:shadow-[var(--shadow-card)]",
  ),
};

function GlazeOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(ellipse_at_top,var(--halo),transparent_72%)]"
    />
  );
}

export function Card({ children, className, variant = "surface" }: CardProps) {
  const showGlaze = variant === "raised" || variant === "hero";

  return (
    <div className={clsx(variantStyles[variant], "p-4", className)}>
      {showGlaze && <GlazeOverlay />}
      {showGlaze ? <div className="relative">{children}</div> : children}
    </div>
  );
}
