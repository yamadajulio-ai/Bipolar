import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function AvaliacaoSemanalLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-52 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      {/* Progress bar */}
      <SkeletonBlock className="h-2 w-full rounded-full mb-6" />

      {/* Question cards */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-4">
          <SkeletonBlock className="h-5 w-full mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((j) => (
              <SkeletonBlock key={j} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
