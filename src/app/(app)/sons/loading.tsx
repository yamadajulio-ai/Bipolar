import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function SonsLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-24 mb-1" />
      <SkeletonBlock className="h-4 w-48 mb-6" />

      {/* Audio player cards */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-32 mb-1" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
