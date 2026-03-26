"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function SOSButton() {
  return (
    <Link
      href="/sos"
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-danger text-white shadow-[var(--shadow-float)] no-underline focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 lg:bottom-6 lg:right-6"
      aria-label="SOS - Preciso de ajuda"
    >
      <ShieldAlert size={24} strokeWidth={2} aria-hidden />
    </Link>
  );
}
