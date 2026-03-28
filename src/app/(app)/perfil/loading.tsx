import { SkeletonBlock, SkeletonCard } from "@/components/Skeleton";

export default function PerfilLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Carregando...</span>
      <SkeletonBlock className="h-8 w-28 mb-6" />

      {/* Profile form fields */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="mb-4">
          <SkeletonBlock className="h-4 w-24 mb-2" />
          <SkeletonBlock className="h-11 w-full rounded-md" />
        </div>
      ))}

      <SkeletonBlock className="h-12 w-full rounded-[var(--radius-card)] mt-6" />
    </div>
  );
}
