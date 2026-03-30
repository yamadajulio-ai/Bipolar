"use client";

import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "motion/react";

interface ModalBottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

/**
 * iOS-style bottom sheet with drag handle, rubber-band drag, and backdrop.
 * Dismiss by dragging down past threshold or tapping backdrop.
 */
export function ModalBottomSheet({ open, onClose, children, title }: ModalBottomSheetProps) {
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 300) {
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[var(--z-modal)] bg-black/40"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={title || "Painel"}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              mass: 0.8,
            }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.1, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-[var(--z-modal)] max-h-[85vh] overflow-y-auto rounded-t-[var(--radius-panel)] bg-surface pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-float)]"
          >
            {/* Drag handle */}
            <div className="sticky top-0 z-10 flex justify-center bg-surface pt-2 pb-1">
              <div
                className="h-1 w-9 rounded-full bg-muted/30"
                onPointerDown={(e) => dragControls.start(e)}
              />
            </div>

            {title && (
              <h2 className="px-4 pb-2 text-base font-semibold text-foreground">
                {title}
              </h2>
            )}

            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
