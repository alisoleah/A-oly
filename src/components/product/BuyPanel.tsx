"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice, type Piasters } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { SizeSelector } from "@/components/product/SizeSelector";
import { ColorwaySelector } from "@/components/product/ColorwaySelector";
import { useCart } from "@/components/cart/CartProvider";
import { analytics } from "@/lib/analytics";
import { messages } from "@/i18n/messages";

/**
 * BuyPanel — the sticky right column of the PDP (design-system.md §4, §5).
 *
 * Client component: holds colorway + size selection in local state and derives
 * the resolved variant, its price, and per-size availability for the chosen
 * colorway. The Add-to-cart server action is wired in Phase 2; for now the
 * button validates that a size is selected and reflects availability.
 *
 * Data arrives serialized from the server (ProductDetailVM) so this component
 * is portable and testable in isolation.
 */

export interface BuyPanelVariant {
  id: string;
  colorway: string;
  size: string;
  available: number;
  price: Piasters;
}

export function BuyPanel({
  productName,
  collection,
  colorways,
  variants,
  priceFrom,
  fabricNote,
  careNote,
  description,
}: {
  productName: string;
  collection: string;
  colorways: { name: string; hex: string }[];
  variants: BuyPanelVariant[];
  priceFrom: Piasters;
  fabricNote: string;
  careNote: string;
  description: string;
}) {
  const initialColorway = colorways[0]?.name ?? "";
  const [colorway, setColorway] = useState(initialColorway);
  const [size, setSize] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { add } = useCart();

  // Variants for the currently-selected colorway, one row per size.
  const sizeOptions = useMemo(() => {
    return variants
      .filter((v) => v.colorway === colorway)
      .map((v) => ({ size: v.size, available: v.available }));
  }, [variants, colorway]);

  // Resolved variant + price for the current selection.
  const resolved = useMemo(() => {
    if (!size) return null;
    return variants.find((v) => v.colorway === colorway && v.size === size) ?? null;
  }, [variants, colorway, size]);

  const resolvedPrice = resolved?.price ?? priceFrom;
  const resolvedAvailable = resolved?.available ?? 0;
  const canAdd = resolved !== null && resolvedAvailable > 0;

  // Fire view_item once on PDP mount (analytics: GA4/Meta-ready dataLayer push).
  useEffect(() => {
    analytics.viewItem({
      id: productName,
      name: productName,
      variant: initialColorway,
      price: resolvedPrice / 100, // piasters → major EGP
      quantity: 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleColorwayChange(cw: string) {
    setColorway(cw);
    setError(null);
    // A size valid in one colorway exists in all (same size run), but its
    // availability may differ — clear selection so the user re-picks deliberately.
    setSize(null);
  }

  async function handleAdd() {
    if (!canAdd) return;
    setAdding(true);
    setError(null);
    const result = await add(resolved!.id, 1);
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
    } else {
      analytics.addToCart({
        id: productName,
        name: productName,
        variant: `${colorway} · ${size}`,
        price: resolved!.price / 100, // piasters → major EGP
        quantity: 1,
      });
    }
  }

  return (
    <div className="flex flex-col">
      <p className="text-meta mb-2">{collection}</p>
      <h1 className="font-display text-3xl md:text-4xl lowercase leading-tight">
        {productName}
      </h1>
      <p className="text-price text-ink mt-3 text-lg">
        {formatPrice(resolvedPrice)}
      </p>

      <ColorwaySelector
        colorways={colorways}
        selected={colorway}
        onSelect={handleColorwayChange}
      />
      <SizeSelector
        options={sizeOptions}
        selected={size}
        onSelect={setSize}
      />

      <div className="mt-6">
        <Button
          variant="primary"
          onClick={handleAdd}
          disabled={!canAdd || adding}
          className="w-full"
        >
          {adding ? "Adding…" : canAdd ? messages.product.addToCart : messages.product.selectSize}
        </Button>
        {error && <p className="text-meta text-error mt-2">{error}</p>}
        {!canAdd && size && resolvedAvailable <= 0 && (
          <p className="text-meta text-error mt-2">{messages.product.soldOut}</p>
        )}
        <p className="text-meta mt-3 text-center">{messages.product.freeShippingNote}</p>
      </div>

      {/* Details — fabric, care, description */}
      <div className="mt-8 space-y-5 border-t border-line pt-6 text-sm leading-6 text-ink-soft">
        <p>{description}</p>
        <Detail label={messages.product.fabric} body={fabricNote} />
        <Detail label={messages.product.care} body={careNote} />
      </div>
    </div>
  );
}

function Detail({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-meta mb-1">{label}</p>
      <p>{body}</p>
    </div>
  );
}
