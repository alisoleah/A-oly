import type { VerifiedEvent } from "@/lib/payments/provider";

/**
 * Mask a verified event before persisting it as rawPayload.
 *
 * Privacy §F: we store only what fulfilment/audit needs. The verified event
 * itself is already canonical (no card data, no full address) — but we keep the
 * mask layer so any future provider that echoes richer fields stays safe.
 */
export function maskPayload(event: VerifiedEvent): string {
  return JSON.stringify({
    orderRef: event.orderRef,
    eventKey: event.eventKey,
    type: event.type,
    amount: event.amount,
    currency: event.currency,
    providerRef: event.providerRef,
    // intentionally no card/bin/last4/AVS — never present in our flow
  });
}
