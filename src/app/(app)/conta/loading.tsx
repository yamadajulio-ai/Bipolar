import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function ContaLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-32 mb-6" />

      {/* Profile section */}
      <SkeletonCard className="mb-4">
        <div className="flex items-center gap-4 mb-4">
          <SkeletonBlock className="h-16 w-16 rounded-full" />
          <div className="flex-1">
            <SkeletonBlock className="h-5 w-40 mb-2" />
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
      </SkeletonCard>

      {/* Settings sections */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <SkeletonBlock className="h-5 w-32 mb-3" />
          {[1, 2].map((j) => (
            <div key={j} className="flex items-center justify-between py-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </SkeletonCard>
      ))}
    </div>
  );
}
