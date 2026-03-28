import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function AdminLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-28 mb-6" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-4 w-20 mb-2" />
            <SkeletonBlock className="h-7 w-16" />
          </SkeletonCard>
        ))}
      </div>

      {/* Table */}
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-32 mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
