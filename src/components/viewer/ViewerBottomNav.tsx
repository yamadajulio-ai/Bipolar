"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { Home, FileText, Moon, BarChart3, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface ViewerBottomNavProps {
  token: string;
}

export function ViewerBottomNav({ token }: ViewerBottomNavProps) {
  const pathname = usePathname();
  const base = `/profissional/${token}`;

  const tabs: Tab[] = [
    { href: `${base}/hoje`, label: "Hoje", icon: Home },
    { href: `${base}/notas`, label: "Notas", icon: FileText },
    { href: `${base}/sono`, label: "Sono", icon: Moon },
    { href: `${base}/insights`, label: "Insights", icon: BarChart3 },
    { href: `${base}/mais`, label: "Menu", icon: LayoutGrid },
  ];

  return (
    <MotionConfig reducedMotion="user">
      <nav
        aria-label="Navegação do painel profissional"
        className="fixed bottom-0 left-0 right-0 z-[var(--z-nav)] print:hidden lg:hidden"
      >
        <div className="mx-auto max-w-lg px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div
            className={[
              "flex items-center justify-around",
              "rounded-[var(--radius-panel)] py-1.5",
              "border border-border-soft dark:border-border-strong",
              "bg-surface-glass backdrop-blur-[var(--blur-chrome)]",
              "shadow-[var(--shadow-float)]",
              "[contain:layout_style_paint]",
            ].join(" ")}
          >
            {tabs.map((tab) => {
              const isActive =
                pathname === tab.href ||
                (tab.href !== `${base}/hoje` && pathname.startsWith(tab.href + "/"));

              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-card)] py-3 no-underline transition-colors"
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive && (
                    <motion.span
                      aria-hidden="true"
                      layoutId="viewer-nav-pill"
                      className="absolute inset-1 rounded-[var(--radius-card)] bg-primary/10 dark:bg-primary/15"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 34,
                      }}
                    />
                  )}
                  <span className="relative z-10">
                    <Icon
                      size={20}
                      strokeWidth={isActive ? 2 : 1.75}
                      className={
                        isActive
                          ? "text-primary-dark dark:text-primary-light"
                          : "text-muted transition-colors"
                      }
                    />
                  </span>
                  <span
                    className={`relative z-10 text-xs font-semibold ${
                      isActive ? "text-primary-dark dark:text-primary-light" : "text-muted"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </MotionConfig>
  );
}
