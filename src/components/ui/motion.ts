import type { Transition, Variants } from "motion/react";

/** Default, calm spring for small interactive elements (buttons, pills, cards). */
export const spring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

/** Softer spring for sheets / layout transitions. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 1,
};

/** Fade + rise entrance for individual items. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

/** Wrap a list container with this to stagger `fadeUp` children. */
export const listStagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.03 },
  },
};

/** Quick, calm exit for items leaving a list (mirrors --dur-fast). */
export const exitFast: Transition = {
  duration: 0.15,
  ease: [0.22, 1, 0.36, 1],
};
