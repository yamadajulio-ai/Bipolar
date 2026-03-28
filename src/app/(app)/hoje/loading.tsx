import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function HojeLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      {/* Greeting */}
      <SkeletonBlock className="h-7 w-48 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      {/* Status zone card */}
      <SkeletonCard className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonBlock className="h-3 w-full mb-1" />
        <SkeletonBlock className="h-3 w-3/4" />
      </SkeletonCard>

      {/* 2 Action cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[1, 2].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-10 w-10 rounded-full mb-3" />
            <SkeletonBlock className="h-4 w-24 mb-1" />
            <SkeletonBlock className="h-3 w-32" />
          </SkeletonCard>
        ))}
      </div>

      {/* Today summary */}
      <SkeletonBlock className="h-5 w-32 mb-3" />
      <SkeletonCard className="mb-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* 7-day chart */}
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-36 mb-3" />
        <SkeletonBlock className="h-32 w-full rounded" />
      </SkeletonCard>
    </div>
  );
}
