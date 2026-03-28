import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function NoticiasLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-28 mb-1" />
      <SkeletonBlock className="h-4 w-48 mb-6" />

      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <SkeletonBlock className="h-5 w-48 mb-2" />
          <SkeletonBlock className="h-3 w-full mb-1" />
          <SkeletonBlock className="h-3 w-3/4 mb-2" />
          <SkeletonBlock className="h-3 w-20" />
        </SkeletonCard>
      ))}
    </div>
  );
}
