"use client";

import Link from "next/link";

export function SOSButton() {
  return (
    <Link
      href="/sos"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-danger text-2xl text-white shadow-lg no-underline transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
      aria-label="SOS - Preciso de ajuda"
    >
      <span aria-hidden="true">SOS</span>
    </Link>
  );
}
