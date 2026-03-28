import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function ExerciciosLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-48 mb-6" />

      {/* Exercise cards */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i}>
            <SkeletonBlock className="h-12 w-12 rounded-full mb-3 mx-auto" />
            <SkeletonBlock className="h-4 w-24 mb-1 mx-auto" />
            <SkeletonBlock className="h-3 w-32 mx-auto" />
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
