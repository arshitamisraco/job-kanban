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
    className: "absolute -top-[10vw] -left-[10vw] h-[55vw] w-[55vw] rounded-pill bg-orb-1 opacity-70",
    style: { filter: "blur(var(--blur-orb))" },
    duration: 48,
  },
  {
    className: "absolute top-[10vh] -right-[10vw] h-[45vw] w-[45vw] rounded-pill bg-orb-2 opacity-80",
    style: { filter: "blur(var(--blur-orb))" },
    duration: 56,
  },
  {
    className: "absolute -bottom-[12vw] left-[5vw] h-[40vw] w-[40vw] rounded-pill bg-orb-3 opacity-90",
    style: { filter: "blur(var(--blur-orb))" },
    duration: 40,
  },
];

export function Background() {
  const reducedMotion = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
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
