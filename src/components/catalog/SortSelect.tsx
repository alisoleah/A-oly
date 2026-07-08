"use client";

import { messages } from "@/i18n/messages";

/**
 * The sort options for a product listing. Shared between ProductGrid state and
 * the SortSelect dropdown so labels stay in sync.
 */
export type SortKey = "featured" | "priceAsc" | "priceDesc" | "nameAsc";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: messages.catalog.sortBy.featured },
  { value: "priceAsc", label: messages.catalog.sortBy.priceAsc },
  { value: "priceDesc", label: messages.catalog.sortBy.priceDesc },
  { value: "nameAsc", label: messages.catalog.sortBy.nameAsc },
];

/**
 * SortSelect — a styled native <select>. Native controls give us keyboard +
 * screen-reader support for free; we just theme them to the house look.
 */
export function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-meta">{messages.catalog.sort}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-11 border border-line bg-ivory px-3 text-sm text-ink transition-colors duration-[var(--animate-duration-fast)] hover:border-ink-soft focus:border-ink focus:outline-none"
        aria-label={messages.catalog.sort}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
