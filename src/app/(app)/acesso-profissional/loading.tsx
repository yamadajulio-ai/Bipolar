import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

export default function AcessoProfissionalLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-52 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      <SkeletonCard className="mb-4">
        <SkeletonBlock className="h-5 w-36 mb-3" />
        <SkeletonText lines={2} />
        <SkeletonBlock className="h-11 w-full rounded-md mt-3" />
      </SkeletonCard>

      <SkeletonCard>
        <SkeletonBlock className="h-5 w-40 mb-3" />
        <SkeletonText lines={3} />
      </SkeletonCard>
    </div>
  );
}
