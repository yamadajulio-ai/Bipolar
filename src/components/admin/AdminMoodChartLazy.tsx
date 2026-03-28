"use client";

import dynamic from "next/dynamic";

export const AdminMoodChartLazy = dynamic(
  () => import("@/components/admin/AdminMoodChart").then((m) => m.AdminMoodChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
