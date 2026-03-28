"use client";

import dynamic from "next/dynamic";

const MiniTrendChart = dynamic(
  () => import("./MiniTrendChart").then((m) => m.MiniTrendChart),
  { ssr: false, loading: () => <div className="h-[180px] animate-pulse rounded-lg bg-surface-alt" /> },
);

interface DashboardChartWrapperProps {
  data: Array<{ date: string; mood: number; sleepHours: number }>;
}

export function DashboardChartWrapper({ data }: DashboardChartWrapperProps) {
  return <MiniTrendChart data={data} />;
}
