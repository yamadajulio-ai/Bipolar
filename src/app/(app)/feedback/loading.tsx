import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function FeedbackLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-32 mb-1" />
      <SkeletonBlock className="h-4 w-52 mb-6" />

      <SkeletonCard>
        <SkeletonBlock className="h-4 w-36 mb-3" />
        <SkeletonBlock className="h-24 w-full rounded-md mb-4" />
        <SkeletonBlock className="h-12 w-full rounded-[var(--radius-card)]" />
      </SkeletonCard>
    </div>
  );
}
