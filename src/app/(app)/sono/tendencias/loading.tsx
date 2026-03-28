import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function SonoTendenciasLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-40 mb-1" />
      <SkeletonBlock className="h-4 w-56 mb-6" />

      {/* Chart */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-32 mb-3" />
        <SkeletonBlock className="h-40 w-full rounded" />
      </SkeletonCard>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-4 w-20 mb-2" />
            <SkeletonBlock className="h-6 w-16" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
