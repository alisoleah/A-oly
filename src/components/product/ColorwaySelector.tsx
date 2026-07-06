"use client";

import { cn } from "@/lib/cn";

/**
 * ColorwaySelector — colorway dots that switch the gallery + size availability.
 * Selected = gold ring (design-system.md §5). Each dot is a labelled button.
 */
export function ColorwaySelector({
  colorways,
  selected,
  onSelect,
}: {
  colorways: { name: string; hex: string }[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  return (
    <fieldset className="mt-6">
      <legend className="text-meta mb-3">Colour</legend>
      <div className="flex items-center gap-3">
        {colorways.map((cw) => {
          const isSel = selected === cw.name;
          return (
            <button
              key={cw.name}
              type="button"
              onClick={() => onSelect(cw.name)}
              aria-pressed={isSel}
              aria-label={cw.name}
              title={cw.name}
              className={cn(
                "block h-6 w-6 rounded-full border transition-shadow duration-[var(--animate-duration-fast)]",
                isSel
                  ? "ring-2 ring-gold ring-offset-2 ring-offset-ivory border-transparent"
                  : "border-line hover:border-ink-soft",
              )}
              style={{ backgroundColor: cw.hex }}
            />
          );
        })}
        <span className="text-sm text-ink-soft ms-1">{selected}</span>
      </div>
    </fieldset>
  );
}
