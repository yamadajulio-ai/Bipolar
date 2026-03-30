"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * iOS-style page transition wrapper.
 * Uses a subtle fade+slide to simulate native push navigation.
 * Wraps children in AnimatePresence-less motion.div keyed by pathname.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.25, 0.1, 0.25, 1], // iOS ease curve
      }}
    >
      {children}
    </motion.div>
  );
}
