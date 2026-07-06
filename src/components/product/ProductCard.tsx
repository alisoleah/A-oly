import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/cn";
import { messages } from "@/i18n/messages";
import type { ProductCardVM } from "@/lib/catalog";

/**
 * ProductCard (design-system.md §5):
 *  - 4:5 portrait image, edge-to-edge
 *  - name + price below on ivory (no text overlays on photos)
 *  - colorway dots (12px, 1px line border; selected would be gold ring)
 *  - hover: image swaps to second shot (--dur-base)
 *
 * Server component — no client interactivity needed for the card itself.
 * The hover swap is pure CSS.
 */
export function ProductCard({ product }: { product: ProductCardVM }) {
  const href = product.collection === "AETHRA" ? `/aethra/${product.slug}` : `/aether/${product.slug}`;
  return (
    <Link href={href} className="group block" aria-label={`${product.name}, from ${formatPrice(product.priceFrom)}`}>
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

      <div className="mt-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[18px] leading-7 font-medium text-ink">{product.name}</h3>
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
                cw.hex.toLowerCase() === "#1a1a1a" && "ring-1 ring-inset ring-line",
              )}
              style={{ backgroundColor: cw.hex }}
              aria-label={cw.name}
              title={cw.name}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
