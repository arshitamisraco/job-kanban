"use client";

import type { CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";

type Orb = {
  className: string;
  style: CSSProperties;
  duration: number;
};

const ORBS: Orb[] = [
  {
    className: "absolute -top-[25vw] -left-[20vw] h-[70vw] w-[70vw] rounded-pill",
    style: { background: "radial-gradient(circle at center, var(--color-orb-1) 0%, transparent 70%)" },
    duration: 48,
  },
  {
    className: "absolute top-[5vh] -right-[25vw] h-[60vw] w-[60vw] rounded-pill",
    style: { background: "radial-gradient(circle at center, var(--color-orb-2) 0%, transparent 70%)" },
    duration: 56,
  },
  {
    className: "absolute -bottom-[20vw] left-[10vw] h-[55vw] w-[55vw] rounded-pill",
    style: { background: "radial-gradient(circle at center, var(--color-orb-3) 0%, transparent 70%)" },
    duration: 40,
  },
];

export function Background() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: "linear-gradient(180deg, var(--color-canvas) 0%, var(--color-canvas-2) 100%)" }}
    >
      {ORBS.map((orb, index) => (
        <motion.div
          key={index}
          className={orb.className}
          style={orb.style}
          animate={reducedMotion ? undefined : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={
            reducedMotion
              ? undefined
              : { duration: orb.duration, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  );
}

export default Background;
