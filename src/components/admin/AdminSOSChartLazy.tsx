"use client";

import dynamic from "next/dynamic";

export const AdminSOSChartLazy = dynamic(
  () => import("@/components/admin/AdminSOSChart").then((m) => m.AdminSOSChart),
  { ssr: false, loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-surface-alt" /> },
);
