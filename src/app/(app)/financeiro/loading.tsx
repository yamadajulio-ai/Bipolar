import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function FinanceiroLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-36 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[1, 2].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-4 w-20 mb-2" />
            <SkeletonBlock className="h-7 w-28" />
          </SkeletonCard>
        ))}
      </div>

      {/* Chart */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-32 mb-3" />
        <SkeletonBlock className="h-40 w-full rounded" />
      </SkeletonCard>

      {/* Transactions */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
