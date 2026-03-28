import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function ProfissionalLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-7 w-52 mb-1" />
      <SkeletonBlock className="h-4 w-72 mb-6" />

      {/* Patient summary */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-36 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <SkeletonBlock className="h-3 w-20 mb-1" />
              <SkeletonBlock className="h-5 w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>

      {/* Chart */}
      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-32 mb-3" />
        <SkeletonBlock className="h-40 w-full rounded" />
      </SkeletonCard>

      {/* History table */}
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
