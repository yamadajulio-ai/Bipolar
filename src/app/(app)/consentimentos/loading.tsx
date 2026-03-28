import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function ConsentimentosLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-48 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      {/* Consent toggles */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <SkeletonBlock className="h-5 w-40 mb-1" />
              <SkeletonBlock className="h-3 w-56" />
            </div>
            <SkeletonBlock className="h-6 w-12 rounded-full ml-4" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
