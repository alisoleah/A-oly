"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Reveal — opacity + translateY(8px) entrance, settles once on scroll-in.
 *
 * Replaces the inert `.reveal` CSS class with a framer-motion `whileInView`
 * implementation. Honours design-system.md §7:
 *  - "things settle, they don't bounce" → ease-brand curve, no spring overshoot
 *  - reveals happen once, no re-trigger (viewport amount 0.2, once: true)
 *  - prefers-reduced-motion → renders children static (no transform/opacity)
 */
export function Reveal({
  children,
  className,
  delay = 0,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Optional stagger delay in seconds (for sequential entrances). */
  delay?: number;
} & Omit<HTMLMotionProps<"div">, "children">) {
  const reduce = useReducedMotion();

  if (reduce) {
    // Reduced-motion users get the content immediately, no transform.
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.22, 1, 0.36, 1], // --ease-brand
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
