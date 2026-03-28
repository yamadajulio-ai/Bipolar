import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function CursosLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-28 mb-1" />
      <SkeletonBlock className="h-4 w-48 mb-6" />

      {/* Course cards */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <SkeletonBlock className="h-32 w-full rounded mb-3" />
          <SkeletonBlock className="h-5 w-40 mb-2" />
          <SkeletonBlock className="h-3 w-full mb-1" />
          <SkeletonBlock className="h-3 w-2/3" />
          <SkeletonBlock className="h-2 w-full rounded-full mt-3" />
        </SkeletonCard>
      ))}
    </div>
  );
}
