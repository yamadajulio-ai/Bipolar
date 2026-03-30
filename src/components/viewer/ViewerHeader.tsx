"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, MoonStar, Printer, Eye } from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";

interface ViewerHeaderProps {
  patientName: string;
  token: string;
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

export function ViewerHeader({ patientName, token }: ViewerHeaderProps) {
  const pathname = usePathname();
  const base = `/profissional/${token}`;

  const navLinks = [
    { href: `${base}/hoje`, label: "Hoje" },
    { href: `${base}/notas`, label: "Notas" },
    { href: `${base}/sono`, label: "Sono" },
    { href: `${base}/insights`, label: "Insights" },
    { href: `${base}/mais`, label: "Mais" },
  ];

  return (
    <header className="border-b border-border-soft bg-surface-glass pt-[env(safe-area-inset-top)] shadow-[var(--shadow-float)] backdrop-blur-[var(--blur-chrome)] print:hidden [contain:layout_style_paint] dark:border-border-strong">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href={`${base}/hoje`}
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

        {/* Desktop nav */}
        <nav
          aria-label="Menu do painel profissional"
          className="hidden items-center gap-3 text-sm lg:flex"
        >
          {navLinks.map((link) => {
            const isCurrent = pathname === link.href || pathname.startsWith(link.href + "/");
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
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-info-bg-subtle px-2.5 py-1 text-xs font-semibold text-info-fg">
            <AppIcon icon={Eye} size="sm" />
            {patientName}
          </span>
          <ThemeButton />
          <button
            onClick={() => window.print()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/20 hover:text-foreground"
            aria-label="Imprimir / Exportar PDF"
            title="Imprimir"
          >
            <AppIcon icon={Printer} size="sm" />
          </button>
        </nav>

        {/* Mobile: compact */}
        <div className="flex items-center gap-1.5 lg:hidden">
          <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-info-bg-subtle px-2 py-1 text-[10px] font-semibold text-info-fg">
            <AppIcon icon={Eye} size="sm" />
            Leitura
          </span>
          <ThemeButton />
          <button
            onClick={() => window.print()}
            className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted/20 hover:text-foreground"
            aria-label="Imprimir"
          >
            <AppIcon icon={Printer} size="sm" />
          </button>
        </div>
      </div>
    </header>
  );
}
