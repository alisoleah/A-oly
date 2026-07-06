import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * aïoly wordmark — always set in Cormorant Garamond, lowercase, tracking +0.01em.
 * design-system.md §2: "Never set the wordmark in another font."
 * The diaeresis over the ï is part of the mark and lives in the source string.
 *
 * `linked` (default) wraps it in <Link href="/">. Pass linked={false} to render a
 * bare span for contexts where navigation isn't wanted (e.g. footer copyright).
 */
export function Wordmark({
  className,
  linked = true,
}: {
  className?: string;
  linked?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "font-display font-medium lowercase tracking-[0.01em] text-ink",
        "leading-none select-none",
        className,
      )}
      aria-label="aïoly — home"
    >
      aïoly
    </span>
  );

  if (!linked) return mark;
  return (
    <Link href="/" aria-label="aïoly — home">
      {mark}
    </Link>
  );
}
