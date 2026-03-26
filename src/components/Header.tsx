"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

interface HeaderProps {
  isLoggedIn?: boolean;
}

const navLinks = [
  { href: "/hoje", label: "Hoje" },
  { href: "/checkin", label: "Check-in" },
  { href: "/sono", label: "Sono" },
  { href: "/insights", label: "Insights" },
  { href: "/mais", label: "Mais" },
];

async function clearSwCache() {
  // Deterministic: delete API cache directly from client (Cache API is available in window)
  try {
    await caches.delete("rb-api-v2");
  } catch {
    // Cache API not available or already deleted
  }
  // Also notify SW to clear its in-memory TTL tracker
  if ("serviceWorker" in navigator) {
    try {
      const sw = navigator.serviceWorker.controller
        || (await navigator.serviceWorker.ready).active;
      if (sw) sw.postMessage({ type: "CLEAR_AUTH_CACHES" });
    } catch { /* SW not available */ }
  }
}

function ThemeButton() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />; // placeholder to avoid layout shift
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className="rounded-full p-1.5 text-lg transition-colors hover:bg-muted/20"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}

export function Header({ isLoggedIn }: HeaderProps) {
  const pathname = usePathname();

  async function handleLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await clearSwCache();
    // Clear health-data drafts (check-in, assessment, journal) before logout.
    // Belt-and-suspenders: server also sends Clear-Site-Data header, but not all browsers support it.
    try { sessionStorage.clear(); } catch { /* ignore */ }
    (e.target as HTMLFormElement).submit();
  }

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={isLoggedIn ? "/hoje" : "/"} className="flex items-center gap-2 text-lg font-semibold text-primary-dark no-underline">
          <Image src="/icon-192.png" alt="" width={28} height={28} className="rounded-md" />
          Suporte Bipolar
        </Link>

        {isLoggedIn ? (
          <>
            {/* Desktop nav */}
            <nav aria-label="Navegação principal" className="hidden items-center gap-3 text-sm lg:flex">
              {navLinks.map((link) => {
                const isCurrent = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={isCurrent ? "font-medium text-foreground no-underline" : "text-muted hover:text-foreground no-underline"}
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <ThemeButton />
              <Link
                href="/sos"
                className="ml-1 rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white no-underline hover:bg-red-700"
              >
                SOS
              </Link>
              <form action="/api/auth/logout" method="POST" onSubmit={handleLogout}>
                <button
                  type="submit"
                  className="rounded bg-primary px-3 py-1 text-white hover:bg-primary-dark"
                >
                  Sair
                </button>
              </form>
            </nav>

            {/* Mobile: theme + SOS + logout, nav handled by BottomNav */}
            <div className="flex items-center gap-1 lg:hidden">
              <ThemeButton />
              <Link
                href="/sos"
                className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white no-underline hover:bg-red-700"
              >
                SOS
              </Link>
              <form action="/api/auth/logout" method="POST" onSubmit={handleLogout}>
                <button
                  type="submit"
                  className="rounded px-3 py-1 text-sm text-muted hover:text-foreground"
                >
                  Sair
                </button>
              </form>
            </div>
          </>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/sos"
              className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white no-underline hover:bg-red-700"
            >
              SOS
            </Link>
            <Link href="/login" className="text-muted hover:text-foreground no-underline">
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-primary px-4 py-1.5 text-sm no-underline hover:bg-primary-dark"
              style={{ color: "#fff" }}
            >
              Criar conta
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
