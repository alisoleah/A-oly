"use client";

import { useEffect } from "react";
import { analytics, type AnalyticsItem } from "@/lib/analytics";

/**
 * PurchaseTracker — fires the GA4 `purchase` event once on the order
 * confirmation page.
 *
 * The confirmation page is a Server Component (it reads the order from the DB),
 * so this tiny client island receives the serializable order data and pushes the
 * event to the dataLayer on mount. Fires exactly once per page view.
 */
export function PurchaseTracker({
  transactionId,
  items,
  value,
}: {
  transactionId: string;
  items: AnalyticsItem[];
  value: number; // major EGP
}) {
  useEffect(() => {
    analytics.purchase(transactionId, items, value);
  }, [transactionId, items, value]);
  return null;
}
