"use client";

import { useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [
  { value: "7", label: "7 noites" },
  { value: "15", label: "15 noites" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "3 meses" },
] as const;

export function NightHistorySelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("noites") ?? "15";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("noites", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1.5" role="group" aria-label="Período do histórico">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleChange(opt.value)}
          aria-pressed={current === opt.value}
          aria-label={`Mostrar últimas ${opt.label}`}
          className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
            current === opt.value
              ? "bg-primary text-white"
              : "bg-black/5 text-muted hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
