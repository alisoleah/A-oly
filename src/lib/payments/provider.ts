import type { Piasters } from "@/lib/money";

/**
 * The PaymentProvider seam (CLAUDE.md §Payments).
 *
 * Both online and (future) Gulf providers implement this. Checkout code talks
 * ONLY to this interface — adding a provider never touches checkout logic.
 *
 *   - createIntent: reserve a payment for an order; returns a hosted-checkout
 *     redirect URL (Paymob) or a local mock page (dev/test).
 *   - verifyWebhook: confirms the inbound request is genuinely from the provider
 *     (HMAC, timing-safe). THROWS on a bad signature — the caller treats any
 *     throw as "reject, do nothing".
 *   - refund: admin-triggered, amount ≤ captured.
 *
 * Card data NEVER touches our servers (hosted checkout / redirect only) —
 * keeping us out of PCI SAQ-D scope.
 */

/** What createOrder hands to the provider to reserve payment for. */
export interface OrderForPayment {
  orderId: string;
  orderNumber: string;
  /** Integer piasters the customer must pay. */
  amount: Piasters;
  currency: string; // "EGP"
  /** Customer email (providers use it for the intention + receipts). */
  email: string;
  /** Customer phone (Fawry requires it; Paymob uses it optionally). */
  phone: string;
  /** First name for the hosted-checkout prefill. */
  firstName: string;
}

/** Result of reserving a payment. */
export interface Intent {
  /** Provider's reference for this intention/transaction (stored on PaymentEvent). */
  providerRef: string;
  /** Where we send the customer to pay (Paymob iframe / mock page). */
  redirectUrl: string;
  /** Optional client secret if the provider uses one (not needed for redirect flows). */
  clientSecret?: string;
}

/**
 * A webhook payload that has passed signature verification. The webhook handler
 * trusts this unconditionally once verifyWebhook returns it.
 */
export interface VerifiedEvent {
  /** Which order this event concerns (provider's merchant order reference). */
  orderRef: string;
  /** Stable per-event id used for dedupe (PaymentEvent.eventKey). */
  eventKey: string;
  type: "payment.succeeded" | "payment.failed" | "refund";
  /** Amount the provider reports was paid — compared against the order total. */
  amount: Piasters;
  currency: string;
  /** Provider's transaction reference. */
  providerRef: string;
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(order: OrderForPayment): Promise<Intent>;
  verifyWebhook(req: Request): Promise<VerifiedEvent>;
  refund(providerRef: string, amount: Piasters): Promise<void>;
}
