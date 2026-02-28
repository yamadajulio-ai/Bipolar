"use client";

import Link from "next/link";
import { useState } from "react";

interface HeaderProps {
  isLoggedIn?: boolean;
}

const navLinks = [
  { href: "/hoje", label: "Hoje" },
  { href: "/planejador", label: "Planejador" },
  { href: "/checkin", label: "Check-in" },
  { href: "/insights", label: "Insights" },
  { href: "/como-usar", label: "Guia" },
  { href: "/mais", label: "Mais" },
];

export function Header({ isLoggedIn }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={isLoggedIn ? "/hoje" : "/"} className="text-lg font-semibold text-primary-dark no-underline">
          Rede Bipolar
        </Link>

        {isLoggedIn ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-3 text-sm lg:flex">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-muted hover:text-foreground no-underline">
                  {link.label}
                </Link>
              ))}
              <Link
                href="/sos"
                className="ml-1 rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white no-underline hover:bg-red-700"
              >
                SOS
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded bg-primary px-3 py-1 text-white hover:bg-primary-dark"
                >
                  Sair
                </button>
              </form>
            </nav>

            {/* Mobile hamburger */}
            <div className="flex items-center gap-2 lg:hidden">
              <Link
                href="/sos"
                className="rounded-lg bg-red-600 px-3 py-1 text-sm font-semibold text-white no-underline hover:bg-red-700"
              >
                SOS
              </Link>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded p-2 text-muted hover:bg-surface-alt"
                aria-label="Menu"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {menuOpen ? (
                    <>
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="6" y1="18" x2="18" y2="6" />
                    </>
                  ) : (
                    <>
                      <line x1="4" y1="6" x2="20" y2="6" />
                      <line x1="4" y1="12" x2="20" y2="12" />
                      <line x1="4" y1="18" x2="20" y2="18" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            {/* Mobile menu dropdown */}
            {menuOpen && (
              <div className="absolute top-14 left-0 right-0 z-50 border-b border-border bg-surface p-4 shadow-lg lg:hidden">
                <nav className="flex flex-col gap-3 text-sm">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-muted hover:text-foreground no-underline"
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <form action="/api/auth/logout" method="POST">
                    <button
                      type="submit"
                      className="w-full rounded bg-primary px-3 py-2 text-white hover:bg-primary-dark"
                    >
                      Sair
                    </button>
                  </form>
                </nav>
              </div>
            )}
          </>
        ) : (
          <nav className="flex items-center gap-4 text-sm">
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
