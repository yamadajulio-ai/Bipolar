import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function CheckinLoading() {
  return (
    <div>
      <SkeletonBlock className="mb-1 h-8 w-28" />
      <SkeletonBlock className="mb-6 h-4 w-56" />

      {/* Mood scale */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="mb-3 h-4 w-24" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-11 flex-1 rounded-lg" />
          ))}
        </div>
      </SkeletonCard>

      {/* Energy scale */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="mb-3 h-4 w-20" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonBlock key={i} className="h-11 flex-1 rounded-lg" />
          ))}
        </div>
      </SkeletonCard>

      {/* Notes */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="mb-3 h-4 w-32" />
        <SkeletonBlock className="h-20 w-full rounded-lg" />
      </SkeletonCard>

      {/* Submit button */}
      <SkeletonBlock className="h-12 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
