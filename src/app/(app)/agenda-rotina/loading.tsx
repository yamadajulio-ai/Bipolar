import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function AgendaRotinaLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-40 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Time slots */}
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-10 w-16 rounded" />
            <div className="flex-1">
              <SkeletonBlock className="h-4 w-36 mb-1" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
            <SkeletonBlock className="h-6 w-6 rounded" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
