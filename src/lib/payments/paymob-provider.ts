import { env } from "@/lib/env";
import { verifyHmac } from "@/lib/payments/hmac";
import type {
  Intent,
  OrderForPayment,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/provider";

/**
 * Canonical Paymob transaction-callback HMAC field order.
 *
 * Verified against Paymob's official "HMAC Transaction Callback" doc (updated
 * 2026-06). The signed string is the concatenation of these values IN THIS
 * EXACT ORDER, taken from the nested `obj` of a TRANSACTION callback:
 *
 *   { type: "TRANSACTION", obj: { amount_cents, created_at, currency,
 *     error_occured, has_parent_transaction, id, integration_id, is_3d_secure,
 *     is_auth, is_capture, is_refunded, is_standalone_payment, is_voided,
 *     order: { id, ... }, owner, pending, source_data: { pan, sub_type, type },
 *     success } }
 *
 * DO NOT REORDER. A different order = a different digest = every webhook
 * rejected. If Paymob ever revises this list, re-verify against the docs and
 * the sandbox test vector in tests/unit/paymob-hmac.test.ts before changing.
 */
export const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order",      // nested → unwrapped to its `id`
  "owner",
  "pending",
  "source_data_pan",      // nested source_data.pan
  "source_data_sub_type", // nested source_data.sub_type
  "source_data_type",     // nested source_data.type
  "success",
] as const;

/**
 * Flatten a Paymob `obj` into the key set the canonical HMAC order expects.
 *
 * Paymob nests `order` and `source_data`; the signed string concatenates their
 * inner values, so we lift:
 *   - order.id             → "order"
 *   - source_data.pan      → "source_data_pan"
 *   - source_data.sub_type → "source_data_sub_type"
 *   - source_data.type     → "source_data_type"
 * Missing keys are omitted from the returned object; the HMAC builder defaults
 * them to "" via `?? ""`, which matches Paymob's own behavior for absent fields.
 *
 * Exported so the HMAC test vector (tests/unit/paymob-hmac.test.ts) can assert
 * the exact concatenated message.
 */
export function flattenPaymobObj(obj: Record<string, unknown>): Record<string, unknown> {
  const order = obj.order;
  const sourceData = obj.source_data as Record<string, unknown> | undefined;

  return {
    ...obj,
    order:
      order !== null && typeof order === "object"
        ? (order as Record<string, unknown>).id
        : order,
    source_data_pan: sourceData?.pan,
    source_data_sub_type: sourceData?.sub_type,
    source_data_type: sourceData?.type,
  };
}

/**
 * PaymobProvider — the production provider using Paymob's Intention API
 * (unified checkout: card + Apple Pay + Google Pay).
 *
 * Integration notes (verify against Paymob's current docs before go-live):
 *  - Authentication: API key → session via POST /auth/tokens.
 *  - Intention: POST /payment_intention/ to reserve the amount; returns a
 *    client_secret + the hosted-checkout URL (redirect).
 *  - Webhook: Paymob sends a callback with an HMAC over an ordered concatenation
 *    of fields. We recompute over that documented order and compare timing-safe.
 *  - EGP minor units: Paymob uses 100 cents = 1 EGP (PAYMOB_CENTS_FACTOR).
 *
 * Card data never touches our servers — the customer is redirected to Paymob's
 * hosted checkout. This keeps us out of PCI SAQ-D scope.
 *
 * Selected by PAYMENT_PROVIDER=paymob (env.ts enforces all keys are present).
 */
export class PaymobProvider implements PaymentProvider {
  readonly name = "paymob";

  private get apiKey() {
    return env.PAYMOB_API_KEY!;
  }
  private get iframeId() {
    return env.PAYMOB_IFRAME_ID!;
  }
  private get centsFactor() {
    return env.PAYMOB_CENTS_FACTOR;
  }
  private get baseUrl() {
    return "https://international.paymob.com/v1";
  }

  /** Exchange an API key for an auth token (cached per request ideally). */
  private async authenticate(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: this.apiKey }),
    });
    if (!res.ok) throw new Error(`Paymob auth failed: ${res.status}`);
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async createIntent(order: OrderForPayment): Promise<Intent> {
    const token = await this.authenticate();

    // Paymob expects the amount in cents (EGP × 100).
    const amountCents = Math.round(order.amount / this.centsFactor * this.centsFactor);

    const res = await fetch(`${this.baseUrl}/payment_intention/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: order.currency,
        payment_methods: env.PAYMOB_INTEGRATION_ID!.split(",").map((id) => id.trim()),
        items: [], // line items can be added for richer receipts later
        customer: { email: order.email, first_name: order.firstName },
        extras: { order_id: order.orderId, order_number: order.orderNumber },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Paymob intention failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      id: string;
      client_secret: string;
      payment_keys?: string[];
    };

    const providerRef = String(data.id);
    const paymentKey = data.payment_keys?.[0] ?? "";
    // Hosted checkout iframe URL; wallets render inside when device-supported.
    const redirectUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/checkout/paymob?ref=${providerRef}&k=${paymentKey}&iframe=${this.iframeId}`;

    return { providerRef, redirectUrl, clientSecret: data.client_secret };
  }

  /**
   * Verify a Paymob transaction webhook.
   *
   * Per Paymob's docs (verified 2026-06):
   *  - Algorithm: HMAC-**SHA512** (NOT sha256).
   *  - The HMAC is delivered as a **query parameter** `?hmac=...`, not a header.
   *  - The signed data is the nested `obj` of `{ type: "TRANSACTION", obj: {...} }`.
   *  - The signed string is the concatenation of a canonical field list (above),
   *    with nested `order` unwrapped to its `id` and `source_data.*` flattened.
   *
   * We rebuild that exact string, recompute the digest with our secret, and
   * compare timing-safe. Any mismatch throws — the caller rejects the request.
   */
  async verifyWebhook(req: Request): Promise<VerifiedEvent> {
    // Paymob delivers the HMAC as a query param; the body is JSON.
    const url = new URL(req.url);
    const receivedHmac = url.searchParams.get("hmac") ?? "";
    if (!receivedHmac) {
      throw new Error("Paymob webhook missing ?hmac= query parameter.");
    }

    const body = (await req.text()) as string;
    const parsed = JSON.parse(body) as { type?: string; obj?: Record<string, unknown> };

    // TRANSACTION callbacks nest the payload under `obj`. GET callbacks (rare,
    // redirect-style) arrive flat — handle both defensively.
    const obj = parsed.obj ?? (parsed as Record<string, unknown>);
    const flat = flattenPaymobObj(obj);

    const message = HMAC_FIELDS.map((k) => String(flat[k] ?? "")).join("");
    if (!verifyHmac(env.PAYMOB_HMAC_SECRET!, message, receivedHmac, "sha512")) {
      throw new Error("Paymob webhook HMAC verification failed.");
    }

    // Map to our canonical VerifiedEvent.
    const success = flat.success === true || flat.success === "true";
    const orderId = flat.order ?? "";
    const orderRef = String(orderId); // we pass our order_number as Paymob order id/extras

    return {
      orderRef,
      eventKey: `paymob_${flat.id}`, // dedupe on the Paymob transaction id
      type: success ? "payment.succeeded" : "payment.failed",
      amount: Number(flat.amount_cents ?? 0),
      currency: String(flat.currency ?? "EGP"),
      providerRef: String(flat.id ?? ""),
    };
  }

  async refund(providerRef: string, amount: number): Promise<void> {
    const token = await this.authenticate();
    const res = await fetch(`${this.baseUrl}/refund/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify({
        transaction_id: providerRef,
        amount_cents: Math.round(amount / this.centsFactor * this.centsFactor),
      }),
    });
    if (!res.ok) {
      throw new Error(`Paymob refund failed: ${res.status}`);
    }
  }
}
