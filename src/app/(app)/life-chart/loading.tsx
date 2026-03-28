import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function LifeChartLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-56 mb-6" />

      {/* Chart */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-48 w-full rounded" />
      </SkeletonCard>

      {/* Events list */}
      <SkeletonBlock className="h-5 w-28 mb-3" />
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-32 mb-1" />
              <SkeletonBlock className="h-3 w-48" />
            </div>
            <SkeletonBlock className="h-4 w-20" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
