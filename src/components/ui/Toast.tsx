"use client";

import { AnimatePresence, motion } from "motion/react";
import { spring } from "./motion";

export type ToastProps = {
  message: string | null;
};

export function Toast({ message }: ToastProps) {
  return (
    <AnimatePresence>
      {message !== null ? (
        <motion.span
          role="status"
          aria-live="polite"
          className="glass glass-strong rounded-pill px-3 py-1 text-xs text-ink-2"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={spring}
        >
          {message}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}
