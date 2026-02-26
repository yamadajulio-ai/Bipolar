"use client";

import { MiniTrendChart } from "./MiniTrendChart";

interface DashboardChartWrapperProps {
  data: Array<{ date: string; mood: number; sleepHours: number }>;
}

export function DashboardChartWrapper({ data }: DashboardChartWrapperProps) {
  return <MiniTrendChart data={data} />;
}
