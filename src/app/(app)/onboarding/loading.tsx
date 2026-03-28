import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function OnboardingLoading() {
  return (
    <div aria-busy="true" className="flex flex-col items-center justify-center min-h-[60vh]">
      <span className="sr-only" role="status">Carregando...</span>
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBlock key={i} className="h-2 w-2 rounded-full" />
        ))}
      </div>

      <SkeletonCard className="w-full max-w-md">
        <SkeletonBlock className="h-7 w-48 mb-2 mx-auto" />
        <SkeletonBlock className="h-4 w-64 mb-6 mx-auto" />

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>

        <SkeletonBlock className="h-12 w-full rounded-[var(--radius-card)] mt-6" />
      </SkeletonCard>
    </div>
  );
}
