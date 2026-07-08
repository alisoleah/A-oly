"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";
import { messages } from "@/i18n/messages";
import { useQuickView } from "@/components/product/QuickViewProvider";
import type { ProductCardVM } from "@/lib/catalog";

/**
 * ProductCard (design-system.md §5):
 *  - 4:5 portrait image, edge-to-edge
 *  - name + price below on ivory (no text overlays on photos)
 *  - colorway dots (12px, 1px line border)
 *  - hover: image swaps to second shot (--dur-base)
 *  - hover: a Quick View bar slides up from the image's bottom edge
 *
 * Client component because it triggers the QuickView modal via context. The
 * image swap itself stays pure CSS (group-hover), so there's no motion cost
 * for the common hover.
 */
export function ProductCard({ product }: { product: ProductCardVM }) {
  const { open } = useQuickView();
  const href =
    product.collection === "AETHRA"
      ? `/aethra/${product.slug}`
      : `/aether/${product.slug}`;

  return (
    <div className="group block">
      <Link
        href={href}
        aria-label={`${product.name}, from ${formatPrice(product.priceFrom)}`}
        className="block"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-ivory-deep">
          {/* Primary image */}
          <Image
            src={product.imagePrimary.url}
            alt={product.imagePrimary.alt}
            fill
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-opacity duration-[var(--animate-duration-base)] ease-[var(--ease-brand)] group-hover:opacity-0"
            priority={false}
          />
          {/* Hover image — crossfades in */}
          <Image
            src={product.imageHover.url}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover opacity-0 transition-opacity duration-[var(--animate-duration-base)] ease-[var(--ease-brand)] group-hover:opacity-100"
            priority={false}
          />
          {product.soldOut && (
            <span className="absolute top-3 inline-start-3 text-meta bg-ivory/90 px-2 py-1">
              {messages.product.soldOut}
            </span>
          )}
        </div>
      </Link>

      {/* Hover-reveal Quick View bar — sits over the image's bottom edge.
          Clicking it must NOT navigate (it's outside the Link), so it has its
          own button + stopPropagation. */}
      <div className="pointer-events-none relative -mt-12 flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            open(product);
          }}
          className={cn(
            "pointer-events-auto z-10 mb-1 bg-ink/95 px-5 py-2.5 text-[12px] font-medium uppercase tracking-[0.1em] text-ivory",
            "translate-y-4 opacity-0 transition-all duration-[var(--animate-duration-base)] ease-[var(--ease-brand)]",
            "group-hover:translate-y-0 group-hover:opacity-100",
            "hover:bg-ink-soft",
          )}
          aria-label={`${messages.catalog.quickView}: ${product.name}`}
        >
          {messages.catalog.quickView}
        </button>
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[18px] leading-7 font-medium text-ink">
            <Link href={href} className="hover:text-gold transition-colors duration-[var(--animate-duration-fast)]">
              {product.name}
            </Link>
          </h3>
          <p className="text-price text-ink mt-0.5">{formatPrice(product.priceFrom)}</p>
        </div>
        {/* Colorway dots */}
        <div className="flex items-center gap-1.5 pt-1.5">
          {product.colorways.map((cw) => (
            <span
              key={cw.name}
              className={cn(
                "block h-3 w-3 rounded-full border border-line",
                // ink colorway needs a visible ring on ivory
                cw.hex.toLowerCase() === "#1a1a18" && "ring-1 ring-inset ring-line",
              )}
              style={{ backgroundColor: cw.hex }}
              aria-label={cw.name}
              title={cw.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
