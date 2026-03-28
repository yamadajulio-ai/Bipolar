import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function CircadianoLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-36 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Clock visualization */}
      <SkeletonCard className="mb-4 flex items-center justify-center">
        <SkeletonBlock className="h-48 w-48 rounded-full" />
      </SkeletonCard>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
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
