import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function MaisLoading() {
  return (
    <div>
      <SkeletonBlock className="mb-6 h-8 w-20" />

      {/* Quick access */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="mb-2 h-5 w-5 rounded" />
            <SkeletonBlock className="h-4 w-24" />
          </SkeletonCard>
        ))}
      </div>

      {/* Sections */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-4">
          <SkeletonBlock className="mb-3 h-5 w-32" />
          <SkeletonCard>
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <SkeletonBlock className="h-5 w-5 shrink-0 rounded" />
                  <div className="flex-1">
                    <SkeletonBlock className="mb-1 h-4 w-28" />
                    <SkeletonBlock className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          </SkeletonCard>
        </div>
      ))}
    </div>
  );
}
