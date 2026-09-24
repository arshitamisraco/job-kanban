"use client";

import { useEffect, useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springSoft } from "./motion";
import { Button } from "./Button";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
};

export function Sheet({ open, onClose, title, children }: SheetProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.div
            className="absolute inset-0 bg-scrim backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass glass-strong relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto rounded-l-xl shadow-sheet"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={springSoft}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 id={titleId} className="text-sm font-semibold text-ink">
                {title}
              </h2>
              <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 1L13 13M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </Button>
            </div>
            {children}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
