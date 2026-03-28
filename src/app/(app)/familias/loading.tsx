import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function FamiliasLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Family member cards */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-5 w-32 mb-1" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-8 w-20 rounded-lg" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
