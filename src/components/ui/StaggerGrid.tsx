"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * StaggerGrid — a product/listing grid whose items cascade in on scroll-in.
 *
 * Container variants stagger children by 60ms; each child does the same
 * settle entrance as Reveal (opacity + 8px translateY, ease-brand). Mirrors the
 * ZEE "cards appear one after the other" effect without the marquee energy.
 *
 * Reduced-motion: children render fully visible, no transform.
 *
 * Usage:
 *   <StaggerGrid className="grid-cols-2 md:grid-cols-3">
 *     <StaggerItem>…</StaggerItem>
 *   </StaggerGrid>
 */
const EASE_BRAND = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE_BRAND },
  },
};

export function StaggerGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <ul className={cn("grid", className)}>{children}</ul>;
  }
  // NOTE: we use `animate` (not `whileInView`) here deliberately. The grid is
  // usually already in/near the viewport on page load, and `whileInView` +
  // `once: true` can miss elements that are already past the threshold on the
  // first paint — leaving cards stuck at opacity:0. `animate` runs immediately
  // on mount, so the stagger plays once and cards are always visible.
  return (
    <motion.ul
      className={cn("grid", className)}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.ul>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <li className={className}>{children}</li>;
  }
  return (
    <motion.li variants={item} className={className}>
      {children}
    </motion.li>
  );
}
