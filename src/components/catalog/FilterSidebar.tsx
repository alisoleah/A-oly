"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import type { Size } from "@/lib/catalog";
import { SIZE_ORDER } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useMessages } from "@/i18n/MessagesProvider";
import { FilterIcon, CloseIcon } from "@/components/ui/Icon";

/**
 * The active filter state shared between FilterSidebar and ProductGrid.
 * Empty arrays = no filter applied on that facet.
 */
export interface FilterState {
  sizes: Size[];
  colours: string[];
}

export const EMPTY_FILTERS: FilterState = { sizes: [], colours: [] };

/** Available facet values derived once from the products on the page. */
export interface Facets {
  sizes: Size[];
  colours: { name: string; hex: string }[];
}

/**
 * FilterSidebar — left rail of facets (size + colour) with a "Clear all".
 *
 * Desktop: a static aside column. Mobile: hidden behind a "Filter" button that
 * opens a bottom sheet (AnimatePresence slide-up) so the rail never cramps a
 * narrow viewport.
 */
export function FilterSidebar({
  facets,
  filters,
  onChange,
  resultCount,
}: {
  facets: Facets;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  resultCount: number;
}) {
  const messages = useMessages();
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = useReducedMotion();

  const hasActive = filters.sizes.length > 0 || filters.colours.length > 0;

  function toggleSize(s: Size) {
    const next = filters.sizes.includes(s)
      ? filters.sizes.filter((x) => x !== s)
      : [...filters.sizes, s];
    onChange({ ...filters, sizes: next });
  }
  function toggleColour(c: string) {
    const next = filters.colours.includes(c)
      ? filters.colours.filter((x) => x !== c)
      : [...filters.colours, c];
    onChange({ ...filters, colours: next });
  }

  // The facet panel itself — rendered both inline (desktop) and in the mobile sheet.
  const Panel = (
    <div className="space-y-8">
      {/* Size */}
      <div>
        <p className="text-meta mb-3">{messages.catalog.size}</p>
        <div className="flex flex-wrap gap-2">
          {SIZE_ORDER.filter((s) => facets.sizes.includes(s)).map((s) => {
            const active = filters.sizes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSize(s)}
                aria-pressed={active}
                className={cn(
                  "h-10 min-w-10 rounded-full border px-3 text-sm transition-colors duration-[var(--animate-duration-fast)]",
                  active
                    ? "border-ink bg-ink text-ivory"
                    : "border-line bg-ivory text-ink hover:border-ink-soft",
                )}
              >
                {s}
              </button>
            );
          })}
          {facets.sizes.length === 0 && (
            <p className="text-sm text-ink-soft">—</p>
          )}
        </div>
      </div>

      {/* Colour */}
      <div>
        <p className="text-meta mb-3">{messages.catalog.colour}</p>
        <div className="flex flex-wrap gap-2.5">
          {facets.colours.map((c) => {
            const active = filters.colours.includes(c.name);
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => toggleColour(c.name)}
                aria-pressed={active}
                aria-label={c.name}
                title={c.name}
                className={cn(
                  "block h-8 w-8 rounded-full border transition-all duration-[var(--animate-duration-fast)]",
                  active
                    ? "ring-2 ring-gold ring-offset-2 ring-offset-ivory border-transparent"
                    : "border-line hover:border-ink-soft",
                  c.hex.toLowerCase() === "#1a1a18" && "ring-1 ring-inset ring-line",
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>

      {hasActive && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-meta text-gold hover:text-ink transition-colors duration-[var(--animate-duration-fast)]"
        >
          {messages.catalog.clearAll}
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden w-56 shrink-0 md:block">
        <p className="text-meta mb-6">
          {messages.catalog.showing
            .replace("{count}", String(resultCount))
            .replace("{count, plural, one {piece} other {pieces}}", resultCount === 1 ? "piece" : "pieces")}
        </p>
        {Panel}
      </aside>

      {/* Mobile filter button */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 border border-line px-4 py-2.5 text-sm text-ink transition-colors duration-[var(--animate-duration-fast)] hover:border-ink-soft"
        >
          <FilterIcon className="h-4 w-4" />
          {messages.catalog.filter}
          {hasActive && (
            <span className="min-w-4 h-4 rounded-full bg-gold px-1 text-[10px] leading-4 text-ivory">
              {filters.sizes.length + filters.colours.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-[55] md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-ink/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close filters"
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto bg-ivory p-6"
              initial={reduce ? { opacity: 0 } : { y: "100%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-6 flex items-center justify-between">
                <p className="text-meta">{messages.catalog.filter}</p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close filters"
                  className="-m-2 p-2 text-ink hover:text-gold"
                >
                  <CloseIcon />
                </button>
              </div>
              {Panel}
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="mt-8 h-12 w-full bg-ink text-sm uppercase tracking-[0.1em] text-ivory transition-colors duration-[var(--animate-duration-fast)] hover:bg-ink-soft"
              >
                {messages.catalog.showing
                  .replace("{count}", String(resultCount))
                  .replace("{count, plural, one {piece} other {pieces}}", resultCount === 1 ? "piece" : "pieces")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
