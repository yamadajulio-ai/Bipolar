"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Sun, MoonStar, LogOut, ShieldAlert } from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";

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
  try {
    await caches.delete("rb-api-v2");
  } catch {
    // Cache API not available or already deleted
  }
  if ("serviceWorker" in navigator) {
    try {
      const sw =
        navigator.serviceWorker.controller ||
        (await navigator.serviceWorker.ready).active;
      if (sw) sw.postMessage({ type: "CLEAR_AUTH_CACHES" });
    } catch {
      /* SW not available */
    }
  }
}

function ThemeButton() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);
  if (!mounted) return <div className="h-11 w-11" aria-hidden="true" />;
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
      className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-muted/20"
    >
      <AppIcon icon={isDark ? Sun : MoonStar} size="sm" className="text-muted" />
    </button>
  );
}

export function Header({ isLoggedIn }: HeaderProps) {
  const pathname = usePathname();

  async function handleLogout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await clearSwCache();
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    // Use fetch instead of native form submit so CsrfProvider adds X-CSRF-Token header
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/";
  }

  return (
    <header className="bg-surface-glass pt-[env(safe-area-inset-top)] shadow-[0_0.5px_0_var(--ios-separator)] backdrop-blur-[20px] print:hidden [contain:layout_style_paint]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href={isLoggedIn ? "/hoje" : "/"}
          className="flex items-center gap-2 text-lg font-semibold text-primary-dark dark:text-primary-light no-underline"
        >
          <Image
            src="/icon-192-transparent.png"
            alt=""
            width={28}
            height={28}
            className="rounded-md"
          />
          Suporte Bipolar
        </Link>

        {isLoggedIn ? (
          <>
            {/* Desktop nav */}
            <nav
              aria-label="Menu principal"
              className="hidden items-center gap-3 text-sm lg:flex"
            >
              {navLinks.map((link) => {
                const isCurrent = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      isCurrent
                        ? "font-medium text-foreground no-underline"
                        : "text-muted hover:text-foreground no-underline"
                    }
                    aria-current={isCurrent ? "page" : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <ThemeButton />
              <Link
                href="/sos"
                className="ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-danger px-3 py-1.5 min-h-[44px] text-sm font-semibold text-on-danger no-underline transition-colors hover:bg-danger/90"
                aria-label="SOS — Preciso de ajuda agora"
              >
                <AppIcon icon={ShieldAlert} size="sm" className="text-on-danger" />
                SOS
              </Link>
              <form
                action="/api/auth/logout"
                method="POST"
                onSubmit={handleLogout}
              >
                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/20 hover:text-foreground"
                  aria-label="Sair"
                  title="Sair"
                >
                  <AppIcon icon={LogOut} size="sm" />
                </button>
              </form>
            </nav>

            {/* Mobile: compact SOS + theme + logout */}
            <div className="flex items-center gap-1.5 lg:hidden">
              <ThemeButton />
              <Link
                href="/sos"
                className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-danger px-2.5 py-1.5 min-h-[44px] text-sm font-semibold text-on-danger no-underline transition-colors hover:bg-danger/90"
                aria-label="SOS — Preciso de ajuda agora"
              >
                <AppIcon icon={ShieldAlert} size="sm" className="text-on-danger" />
                SOS
              </Link>
              <form
                action="/api/auth/logout"
                method="POST"
                onSubmit={handleLogout}
              >
                <button
                  type="submit"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/20 hover:text-foreground"
                  aria-label="Sair"
                  title="Sair"
                >
                  <AppIcon icon={LogOut} size="sm" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
            <ThemeButton />
            <Link
              href="/sos"
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-danger px-3 py-1.5 min-h-[44px] text-sm font-semibold text-on-danger no-underline transition-colors hover:bg-danger/90"
              aria-label="SOS — Preciso de ajuda agora"
            >
              SOS
            </Link>
            <Link
              href="/login"
              className="text-muted no-underline hover:text-foreground"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-[var(--radius-pill)] bg-primary px-4 py-1.5 text-sm text-on-primary no-underline hover:bg-primary-dark"
            >
              Criar conta
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
