"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CartVM } from "@/lib/cart/repository";
import {
  addToCart,
  removeFromCart,
  updateQty,
  type CartActionResult,
} from "@/lib/cart/actions";

/**
 * CartProvider — client-side coordinator for the cart.
 *
 * The SERVER (DB) remains the source of truth for cart contents and totals
 * (CLAUDE.md non-negotiable #4). This context mirrors that server state on the
 * client so the drawer + badge render immediately, and re-fetches from the
 * server after every mutation so totals are always server-computed.
 *
 * Mutations return the action result so callers (PDP, drawer) can show errors.
 */

type CartContextValue = {
  cart: CartVM | null;
  loading: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  add: (variantId: string, qty?: number) => Promise<CartActionResult>;
  setQty: (variantId: string, qty: number) => Promise<CartActionResult>;
  remove: (variantId: string) => Promise<CartActionResult>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      if (res.ok) setCart(await res.json());
    } catch {
      // network errors are non-fatal; the server stays the source of truth
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (promise: Promise<CartActionResult>) => {
      const result = await promise;
      await refresh(); // always re-sync from the server
      return result;
    },
    [refresh],
  );

  const add = useCallback(
    (variantId: string, qty = 1) => {
      return run(addToCart({ variantId, qty })).then((r) => {
        if (r.ok) setDrawerOpen(true); // open drawer on successful add
        return r;
      });
    },
    [run],
  );

  const setQty = useCallback(
    (variantId: string, qty: number) => {
      return run(updateQty({ variantId, qty }));
    },
    [run],
  );

  const remove = useCallback(
    (variantId: string) => {
      return run(removeFromCart({ variantId }));
    },
    [run],
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        drawerOpen,
        openDrawer: () => setDrawerOpen(true),
        closeDrawer: () => setDrawerOpen(false),
        refresh,
        add,
        setQty,
        remove,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
