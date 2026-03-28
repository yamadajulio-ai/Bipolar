"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { hapticHeavy } from "@/lib/capacitor/haptics";

export function SOSButton() {
  return (
    <Link
      href="/sos"
      onClick={() => hapticHeavy()}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-danger text-on-danger shadow-[var(--shadow-float)] no-underline print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
      aria-label="SOS - Preciso de ajuda"
    >
      <ShieldAlert size={24} strokeWidth={2} aria-hidden />
    </Link>
  );
}
