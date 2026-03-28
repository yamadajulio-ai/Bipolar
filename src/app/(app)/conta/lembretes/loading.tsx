import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function LembretesLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-36 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      {/* Reminder items */}
      {[1, 2, 3, 4].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center justify-between">
            <div>
              <SkeletonBlock className="h-5 w-32 mb-1" />
              <SkeletonBlock className="h-3 w-20" />
            </div>
            <SkeletonBlock className="h-6 w-12 rounded-full" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
