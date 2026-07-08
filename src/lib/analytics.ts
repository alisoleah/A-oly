"use client";

/**
 * Analytics events — a thin, provider-agnostic wrapper (Phase 6).
 *
 * Fires the standard ecommerce events (view_item, add_to_cart, begin_checkout,
 * purchase) via the dataLayer so a GA4 / Meta Pixel can consume them. The
 * actual pixel scripts are NOT loaded yet — this only pushes events; wiring
 * the tag manager is a config change, not a code change.
 *
 * Money leaves as integer piasters → converted to major EGP here for analytics.
 */

export interface AnalyticsItem {
  id: string;
  name: string;
  variant?: string;
  price: number; // MAJOR units (EGP), not piasters
  quantity: number;
}

type EventName = "view_item" | "add_to_cart" | "begin_checkout" | "purchase";

interface DataLayerWindow extends Window {
  dataLayer?: unknown[];
}

function push(event: EventName, payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ecommerce: payload });
}

export const analytics = {
  viewItem(item: AnalyticsItem) {
    push("view_item", { items: [item], value: item.price * item.quantity, currency: "EGP" });
  },
  addToCart(item: AnalyticsItem) {
    push("add_to_cart", { items: [item], value: item.price * item.quantity, currency: "EGP" });
  },
  beginCheckout(items: AnalyticsItem[], value: number) {
    push("begin_checkout", { items, value, currency: "EGP" });
  },
  purchase(transactionId: string, items: AnalyticsItem[], value: number) {
    push("purchase", { transactionId, items, value, currency: "EGP" });
  },
};
