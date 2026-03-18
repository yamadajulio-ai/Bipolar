import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

export default function InsightsLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-4" />

      {/* Thermometer skeleton */}
      <SkeletonCard className="mb-6">
        <div className="flex items-center gap-4">
          <SkeletonBlock className="h-24 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-3 w-56" />
          </div>
        </div>
      </SkeletonCard>

      {/* Status card skeleton */}
      <SkeletonCard className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <SkeletonBlock className="h-5 w-28" />
          <SkeletonBlock className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonText lines={3} />
      </SkeletonCard>

      {/* 4 summary cards */}
      <SkeletonBlock className="h-5 w-40 mb-3" />
      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center gap-2 mb-2">
              <SkeletonBlock className="h-5 w-5 rounded" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
            <SkeletonBlock className="h-3 w-full mb-1" />
            <SkeletonBlock className="h-3 w-3/4 mb-2" />
            <SkeletonBlock className="h-8 w-full rounded" />
          </SkeletonCard>
        ))}
      </div>

      {/* Charts area */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-36 mb-3" />
        <SkeletonBlock className="h-40 w-full rounded" />
      </SkeletonCard>
    </div>
  );
}
