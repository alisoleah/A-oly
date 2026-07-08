"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ProductCardVM } from "@/lib/catalog";
import { QuickView } from "@/components/product/QuickView";

/**
 * QuickViewProvider — mounts the QuickView modal once at the app root and
 * exposes `open(product)` so any ProductCard can trigger it without
 * prop-drilling through grids.
 *
 * Keep the provider shallow (just state + the modal); all add-to-cart logic
 * lives inside QuickView, which talks to useCart() directly.
 */
type QuickViewContextValue = {
  open: (product: ProductCardVM) => void;
};

const QuickViewContext = createContext<QuickViewContextValue | null>(null);

export function useQuickView(): QuickViewContextValue {
  const ctx = useContext(QuickViewContext);
  if (!ctx) throw new Error("useQuickView must be used within <QuickViewProvider>");
  return ctx;
}

export function QuickViewProvider({ children }: { children: React.ReactNode }) {
  const [product, setProduct] = useState<ProductCardVM | null>(null);

  const open = useCallback((p: ProductCardVM) => setProduct(p), []);
  const close = useCallback(() => setProduct(null), []);

  return (
    <QuickViewContext.Provider value={{ open }}>
      {children}
      <QuickView product={product} onClose={close} />
    </QuickViewContext.Provider>
  );
}
