"use client";

import { useMessages } from "@/i18n/MessagesProvider";

/**
 * The sort keys for a product listing. Labels are locale-resolved inside the
 * component (useMessages) so they switch with the URL locale.
 */
export type SortKey = "featured" | "priceAsc" | "priceDesc" | "nameAsc";

export const SORT_KEYS: SortKey[] = ["featured", "priceAsc", "priceDesc", "nameAsc"];

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
  const messages = useMessages();

  const labels: Record<SortKey, string> = {
    featured: messages.catalog.sortBy.featured,
    priceAsc: messages.catalog.sortBy.priceAsc,
    priceDesc: messages.catalog.sortBy.priceDesc,
    nameAsc: messages.catalog.sortBy.nameAsc,
  };

  return (
    <label className="inline-flex items-center gap-2">
      <span className="text-meta">{messages.catalog.sort}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-11 border border-line bg-ivory px-3 text-sm text-ink transition-colors duration-[var(--animate-duration-fast)] hover:border-ink-soft focus:border-ink focus:outline-none"
        aria-label={messages.catalog.sort}
      >
        {SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {labels[key]}
          </option>
        ))}
      </select>
    </label>
  );
}
