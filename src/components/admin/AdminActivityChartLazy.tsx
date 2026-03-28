"use client";

import dynamic from "next/dynamic";

export const AdminActivityChartLazy = dynamic(
  () => import("@/components/admin/AdminActivityChart").then((m) => m.AdminActivityChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
