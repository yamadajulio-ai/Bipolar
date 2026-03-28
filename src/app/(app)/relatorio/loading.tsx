import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

export default function RelatorioLoading() {
  return (
    <div className="max-w-2xl mx-auto">
      <SkeletonBlock className="h-8 w-48 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      {/* Summary card */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-32 mb-3" />
        <SkeletonText lines={4} />
      </SkeletonCard>

      {/* Chart */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-40 mb-3" />
        <SkeletonBlock className="h-40 w-full rounded" />
      </SkeletonCard>

      {/* Details */}
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-36 mb-3" />
        <SkeletonText lines={5} />
      </SkeletonCard>
    </div>
  );
}
