import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function MedicamentosLoading() {
  return (
    <div>
      <SkeletonBlock className="h-8 w-40 mb-1" />
      <SkeletonBlock className="h-4 w-56 mb-6" />

      {/* Medication cards */}
      {[1, 2, 3].map((i) => (
        <SkeletonCard key={i} className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="h-6 w-16 rounded-full" />
          </div>
          <SkeletonBlock className="h-3 w-48 mb-1" />
          <SkeletonBlock className="h-3 w-32" />
        </SkeletonCard>
      ))}

      {/* Add button */}
      <SkeletonBlock className="h-12 w-full rounded-[var(--radius-card)] mt-4" />
    </div>
  );
}
