import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function ConteudosLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-36 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Content cards */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <SkeletonBlock className="h-5 w-48 mb-2" />
          <SkeletonBlock className="h-3 w-full mb-1" />
          <SkeletonBlock className="h-3 w-3/4" />
        </SkeletonCard>
      ))}
    </div>
  );
}
