import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function CognitivoLoading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-lg">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-7 w-44 mb-1" />
      <SkeletonBlock className="h-4 w-56 mb-6" />

      {/* Test menu cards */}
      {[1, 2].map((i) => (
        <SkeletonCard key={i} className="mb-4">
          <SkeletonBlock className="h-5 w-36 mb-2" />
          <SkeletonBlock className="h-3 w-full mb-3" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </SkeletonCard>
      ))}

      {/* History section */}
      <SkeletonBlock className="h-5 w-28 mb-3" />
      <SkeletonCard>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 w-16" />
            </div>
          ))}
        </div>
      </SkeletonCard>
    </div>
  );
}
