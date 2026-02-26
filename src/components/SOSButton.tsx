"use client";

import Link from "next/link";

export function SOSButton() {
  return (
    <Link
      href="/sos"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-danger text-2xl text-white shadow-lg no-underline transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
      aria-label="SOS - Preciso de ajuda"
      style={{
        animation: "sos-pulse 2s ease-in-out infinite",
      }}
    >
      <span aria-hidden="true">SOS</span>
      <style>{`
        @keyframes sos-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
          50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </Link>
  );
}
