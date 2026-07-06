import Image from "next/image";
import Link from "next/link";

/**
 * aïoly logo — the real brand asset (icon + wordmark + tagline).
 *
 * The source JPEG (public/brand/logo.jpeg) carries the icon over the "aïoly"
 * wordmark and "MAISON DE MODE EST 2024" tagline, on a solid ivory background.
 * design-system.md §2 forbids setting the wordmark in another font, so every
 * brand placement goes through this component.
 *
 * The asset background is opaque ivory (#F5F1EA), so it must sit on an ivory
 * field — which the header (when scrolled) and footer both provide. Over a
 * transparent/hero region we use a size that keeps it legible.
 */

type LogoProps = {
  /** Pixel height of the rendered logo. Width follows the aspect ratio. */
  height?: number;
  /** Wrap in a link to "/" (default true). False for footer copyright contexts. */
  linked?: boolean;
  className?: string;
  /** Decorative when an adjacent visible label exists; default treats it as content. */
  decorative?: boolean;
};

export function Logo({
  height = 40,
  linked = true,
  className,
  decorative = false,
}: LogoProps) {
  // Source aspect ≈ 345/290 = 1.190 (icon+wordmark, near-square)
  const width = Math.round(height * (345 / 290));

  const img = (
    <Image
      src="/brand/logo.jpeg"
      alt={decorative ? "" : "aïoly — maison de mode"}
      width={width}
      height={height}
      priority
      className={className}
      // The logo is a brand mark; no crisp-retina reflow needed.
      sizes={`${height * 2}px`}
    />
  );

  if (!linked) return img;
  return (
    <Link href="/" aria-label="aïoly — home" className="inline-flex">
      {img}
    </Link>
  );
}
