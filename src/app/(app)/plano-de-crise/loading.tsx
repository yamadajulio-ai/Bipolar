import { SkeletonBlock, SkeletonCard, SkeletonText } from "@/components/Skeleton";

export default function PlanoDeCriseLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-44 mb-1" />
      <SkeletonBlock className="h-4 w-56 mb-6" />

      {/* Crisis plan sections */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-4">
          <SkeletonBlock className="h-5 w-36 mb-3" />
          <SkeletonText lines={3} />
        </SkeletonCard>
      ))}

      {/* Emergency contacts */}
      <SkeletonCard>
        <SkeletonBlock className="h-5 w-44 mb-3" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonBlock className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-28 mb-1" />
              <SkeletonBlock className="h-3 w-36" />
            </div>
          </div>
        ))}
      </SkeletonCard>
    </div>
  );
}
