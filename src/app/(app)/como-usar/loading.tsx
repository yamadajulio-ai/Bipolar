import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

export default function ComoUsarLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-36 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <SkeletonBlock className="h-8 w-8 rounded-full" />
            <SkeletonBlock className="h-5 w-40" />
          </div>
          <SkeletonText lines={2} />
        </SkeletonCard>
      ))}
    </div>
  );
}
