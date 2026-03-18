import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function SonoLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <SkeletonBlock className="h-8 w-20" />
        <SkeletonBlock className="h-10 w-32 rounded-lg" />
      </div>

      {/* 4 summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} className="border-l-4 border-l-border">
            <SkeletonBlock className="h-3 w-16 mb-2" />
            <SkeletonBlock className="h-7 w-20 mb-1" />
            <SkeletonBlock className="h-3 w-32" />
          </SkeletonCard>
        ))}
      </div>

      {/* Records count + link */}
      <div className="mb-4 flex items-center justify-between">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="h-4 w-28" />
      </div>

      {/* History cards */}
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-3 w-40" />
              </div>
              <SkeletonBlock className="h-8 w-14 rounded" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
