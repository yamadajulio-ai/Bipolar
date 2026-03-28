"use client";

import dynamic from "next/dynamic";

export const InsightsChartsLazy = dynamic(
  () => import("@/components/planner/InsightsCharts").then((m) => m.InsightsCharts),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
