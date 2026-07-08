"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpIcon } from "@/components/ui/Icon";
import { messages } from "@/i18n/messages";

/**
 * ScrollToTop — floating ink button, bottom-right, fades in after the user
 * scrolls past one viewport (600px). Respects reduced motion (no slide).
 *
 * Mirrors ZEE's scroll-to-top affordance. Fixed position; pointer events none
 * until visible so it never blocks content.
 */
export function ScrollToTop() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={() =>
            window.scrollTo(
              reduce
                ? { top: 0 }
                : { top: 0, behavior: "smooth" },
            )
          }
          aria-label={messages.catalog.scrollToTop}
          className="fixed bottom-6 end-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-ivory shadow-[0_1px_8px_rgba(26,26,24,0.18)] transition-colors duration-[var(--animate-duration-fast)] hover:bg-ink-soft"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <ArrowUpIcon className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
