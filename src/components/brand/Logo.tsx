import Link from "next/link";
import { Logomark, type MarkVariant } from "@/components/brand/Logomark";
import { cn } from "@/lib/cn";

/**
 * aïoly logo — the brand lockup: logomark above the wordmark.
 *
 * Built from the authoritative aioly-brand.html identity:
 *   - logomark: the four-arc vector mark (Logomark.tsx)
 *   - wordmark: "aïoly" in Cormorant Garamond, weight 300, wide tracking,
 *     with the ï set in bronze (#B8926A) — the brand's signature accent
 *
 * Transparent background, so it sits cleanly over the hero OR the ivory header.
 * `size` controls overall scale; the mark:wordmark ratio is fixed by the brand.
 */

type LogoProps = {
  /** Visual scale: sm (mobile header), md (desktop header), lg (footer). */
  size?: "sm" | "md" | "lg";
  /** Color context the logo sits on. */
  variant?: MarkVariant;
  /** Wrap in a link to "/" (default true). */
  linked?: boolean;
  className?: string;
};

const SIZES = {
  // mark px / wordmark rem
  sm: { mark: 28, word: 1.5 },
  md: { mark: 36, word: 1.9 },
  lg: { mark: 52, word: 2.6 },
} as const;

export function Logo({
  size = "md",
  variant = "light",
  linked = true,
  className,
}: LogoProps) {
  const s = SIZES[size];
  const isLight = variant === "light";
  const wordColor = isLight ? "text-ink" : "text-ivory";

  const lockup = (
    <span className={cn("inline-flex flex-col items-center gap-2 leading-none", className)}>
      <Logomark
        variant={variant}
        width={s.mark}
        height={s.mark}
        style={{ display: "block" }}
      />
      <span
        className={cn("font-display font-light lowercase", wordColor)}
        style={{ fontSize: `${s.word}rem`, letterSpacing: "0.18em", lineHeight: 1 }}
      >
        a<span style={{ color: "#B8926A" }}>ï</span>oly
      </span>
    </span>
  );

  if (!linked) return lockup;
  return (
    <Link href="/" aria-label="aïoly — home" className="inline-flex">
      {lockup}
    </Link>
  );
}
