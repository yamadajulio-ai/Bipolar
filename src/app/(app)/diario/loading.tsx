import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function DiarioLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-48 mb-6" />

      {/* Journal entries */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
          <SkeletonBlock className="h-3 w-full mb-1" />
          <SkeletonBlock className="h-3 w-3/4" />
        </SkeletonCard>
      ))}
    </div>
  );
}
