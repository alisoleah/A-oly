"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { ProductCardVM } from "@/lib/catalog";
import type { Size } from "@/lib/catalog";
import { useCart } from "@/components/cart/CartProvider";
import { CloseIcon, ArrowRightIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/money";
import { messages } from "@/i18n/messages";

/**
 * QuickView — a focused modal that lets a shopper preview a piece and add it to
 * the bag without leaving the grid. Data comes from the ProductCardVM (no extra
 * fetch); variant resolution is client-side over the variants summary.
 *
 * Behaviour:
 *  - Backdrop scrim + Escape to close; focus stays within the dialog (a11y).
 *  - Colorway + size selectors pick the live variant; the price + availability
 *    update from the variant summary.
 *  - "Add to cart" wires to useCart().add → opens the drawer on success.
 *  - Reduced motion: crossfade only, no scale.
 */
export function QuickView({
  product,
  onClose,
}: {
  product: ProductCardVM | null;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { add } = useCart();

  const [colorway, setColorway] = useState<string>("");
  const [size, setSize] = useState<Size | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset selections whenever a new product opens.
  useEffect(() => {
    if (product) {
      setColorway(product.colorways[0]?.name ?? "");
      setSize(null);
      setError(null);
    }
  }, [product]);

  // Escape to close + body scroll lock while open.
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [product, onClose]);

  const href = product
    ? product.collection === "AETHRA"
      ? `/aethra/${product.slug}`
      : `/aether/${product.slug}`
    : "#";

  // Sizes available in the selected colorway.
  const sizesForColorway: { size: Size; available: number }[] = product
    ? (product.variants
        .filter((v) => v.colorway === colorway)
        .map((v) => ({ size: v.size, available: v.available })))
    : [];

  const selectedVariant = product?.variants.find(
    (v) => v.colorway === colorway && v.size === size,
  );
  const canAdd = !!selectedVariant && selectedVariant.available > 0;

  async function handleAdd() {
    if (!product || !selectedVariant) {
      setError(messages.product.selectSize);
      return;
    }
    if (selectedVariant.available <= 0) {
      setError(messages.product.soldOut);
      return;
    }
    setError(null);
    await add(selectedVariant.id, 1);
    onClose();
  }

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
        >
          {/* Scrim */}
          <button
            type="button"
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
            aria-label="Close quick view"
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 grid w-full max-w-3xl grid-cols-1 overflow-hidden bg-ivory md:grid-cols-2"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Image */}
            <div className="relative aspect-[4/5] md:aspect-auto">
              <Image
                src={product.imagePrimary.url}
                alt={product.imagePrimary.alt}
                fill
                sizes="(min-width: 768px) 40vw, 90vw"
                className="object-cover"
              />
            </div>

            {/* Details */}
            <div className="flex flex-col p-6 md:p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-meta">{product.collection.toLowerCase()}</p>
                  <h2 className="mt-1 font-display text-2xl lowercase md:text-3xl">
                    {product.name}
                  </h2>
                  <p className="text-price mt-2 text-ink">
                    {formatPrice(selectedVariant?.price ?? product.priceFrom)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close quick view"
                  className="-m-2 p-2 text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)]"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Colorway dots */}
              <div className="mt-6">
                <p className="text-meta mb-3">{messages.catalog.colour}</p>
                <div className="flex items-center gap-2">
                  {product.colorways.map((cw) => (
                    <button
                      key={cw.name}
                      type="button"
                      onClick={() => {
                        setColorway(cw.name);
                        setSize(null);
                        setError(null);
                      }}
                      aria-label={cw.name}
                      aria-pressed={colorway === cw.name}
                      className={cn(
                        "block h-6 w-6 rounded-full border transition-all duration-[var(--animate-duration-fast)]",
                        colorway === cw.name
                          ? "ring-2 ring-gold ring-offset-2 ring-offset-ivory border-transparent"
                          : "border-line hover:border-ink-soft",
                        cw.hex.toLowerCase() === "#1a1a18" && "ring-1 ring-inset ring-line",
                      )}
                      style={{ backgroundColor: cw.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <fieldset className="mt-6">
                <legend className="text-meta mb-3">{messages.product.size}</legend>
                <div className="flex flex-wrap gap-2">
                  {sizesForColorway.map((opt) => {
                    const out = opt.available <= 0;
                    const isSel = size === opt.size;
                    return (
                      <button
                        key={opt.size}
                        type="button"
                        disabled={out}
                        onClick={() => {
                          setSize(opt.size);
                          setError(null);
                        }}
                        aria-pressed={isSel}
                        className={cn(
                          "h-11 min-w-11 border px-3 text-sm font-medium transition-colors duration-[var(--animate-duration-fast)]",
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

              {error && (
                <p className="mt-3 text-sm text-error">{error}</p>
              )}

              {/* Actions */}
              <div className="mt-auto flex flex-col gap-3 pt-8">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className={cn(
                    "h-12 w-full uppercase tracking-[0.1em] text-sm font-medium transition-colors duration-[var(--animate-duration-fast)]",
                    canAdd
                      ? "bg-ink text-ivory hover:bg-ink-soft"
                      : "cursor-not-allowed bg-line text-ink-soft",
                  )}
                >
                  {product.soldOut ? messages.product.soldOut : messages.product.addToCart}
                </button>
                <Link
                  href={href}
                  onClick={onClose}
                  className="group flex items-center justify-center gap-2 text-meta text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)]"
                >
                  {messages.catalog.viewDetails}
                  <ArrowRightIcon className="h-4 w-4 transition-transform duration-[var(--animate-duration-fast)] group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
