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
      className="fixed bottom-0 left-0 right-0 z-[var(--z-nav)] print:hidden lg:hidden"
    >
      <div className="mx-auto max-w-lg px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div
          className={[
            "flex items-center justify-around",
            "rounded-[var(--radius-panel)] py-1.5",
            "bg-surface-glass backdrop-blur-[20px]",
            "shadow-[0_-0.5px_0_var(--ios-separator)]",
            "[contain:layout_style_paint]",
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
                prefetch={false}
                className="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[var(--radius-card)] py-3 no-underline transition-colors"
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && (
                  <motion.span
                    aria-hidden="true"
                    layoutId="nav-pill"
                    className="absolute inset-1 rounded-[var(--radius-card)] bg-primary/10 dark:bg-primary/15"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      mass: 0.8,
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
