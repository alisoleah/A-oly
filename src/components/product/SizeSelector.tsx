"use client";

import { cn } from "@/lib/cn";
import { useMessages } from "@/i18n/MessagesProvider";

/**
 * SizeSelector (design-system.md §5):
 *  - row of square 44px cells
 *  - selected = ink fill / ivory text
 *  - out of stock = strikethrough + disabled, with a "notify me" link affordance
 *
 * Purely presentational; selection state lives in the parent BuyPanel.
 */
export interface SizeOption {
  size: string;
  available: number;
  /** Lowest price for this size across its variants (per colorway selected upstream). */
}

export function SizeSelector({
  options,
  selected,
  onSelect,
}: {
  options: SizeOption[];
  selected: string | null;
  onSelect: (size: string) => void;
}) {
  const messages = useMessages();
  return (
    <fieldset className="mt-6">
      <legend className="text-meta mb-3">{messages.product.selectSize}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const out = opt.available <= 0;
          const isSel = selected === opt.size;
          return (
            <button
              key={opt.size}
              type="button"
              disabled={out}
              onClick={() => onSelect(opt.size)}
              aria-pressed={isSel}
              aria-label={
                out
                  ? `${opt.size} — ${messages.product.soldOut}`
                  : opt.size
              }
              className={cn(
                "h-11 w-11 border text-sm font-medium transition-colors duration-[var(--animate-duration-fast)]",
                isSel
                  ? "border-ink bg-ink text-ivory"
                  : "border-line bg-ivory text-ink hover:border-ink-soft",
                out && "cursor-not-allowed line-through opacity-40 hover:border-line",
              )}
            >
              {opt.size}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
