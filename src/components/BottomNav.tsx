"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, MotionConfig } from "motion/react";
import { Home, PenLine, Moon, BarChart3, LayoutGrid } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { href: "/hoje", label: "Hoje", icon: Home },
  { href: "/checkin", label: "Check-in", icon: PenLine },
  { href: "/sono", label: "Sono", icon: Moon },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/mais", label: "Menu", icon: LayoutGrid },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <MotionConfig reducedMotion="user">
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
    >
      <div className="mx-auto max-w-lg px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          className={[
            "flex items-center justify-around",
            "rounded-[var(--radius-panel)] py-1.5",
            "border border-border-soft dark:border-border-strong",
            "bg-surface-glass backdrop-blur-[var(--blur-chrome)]",
            "shadow-[var(--shadow-float)]",
          ].join(" ")}
        >
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/hoje" && pathname.startsWith(tab.href + "/"));

            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl py-3 no-underline transition-colors"
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    aria-hidden="true"
                    layoutId="nav-pill"
                    className="absolute inset-1 rounded-2xl bg-primary/10 dark:bg-primary/15"
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
                        ? "text-primary"
                        : "text-foreground/50 transition-colors"
                    }
                  />
                </span>
                <span
                  className={`relative z-10 text-[11px] font-semibold ${
                    isActive ? "text-primary" : "text-foreground/50"
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
