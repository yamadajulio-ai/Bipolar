import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function IntegracoesLoading() {
  return (
    <div>
      <SkeletonBlock className="h-7 w-40 mb-1" />
      <SkeletonBlock className="h-4 w-64 mb-6" />

      {/* Integration cards */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <SkeletonBlock className="h-10 w-10 rounded-lg" />
            <div>
              <SkeletonBlock className="h-4 w-32 mb-1" />
              <SkeletonBlock className="h-3 w-48" />
            </div>
          </div>
          <SkeletonBlock className="h-9 w-full rounded-lg" />
        </SkeletonCard>
      ))}
    </div>
  );
}
