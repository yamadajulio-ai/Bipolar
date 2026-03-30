/** Reusable skeleton primitives with iOS-style shimmer animation */

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`skeleton-shimmer rounded-lg ${className}`}
    />
  );
}

export function SkeletonCard({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden className={`rounded-[var(--radius-card)] border border-border-soft bg-surface p-4 shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  );
}

export function SkeletonText({ lines = 1, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Full card skeleton matching /hoje dashboard cards */
export function SkeletonDashboardCard() {
  return (
    <SkeletonCard>
      <SkeletonBlock className="h-4 w-1/3 mb-3" />
      <SkeletonText lines={3} />
    </SkeletonCard>
  );
}
