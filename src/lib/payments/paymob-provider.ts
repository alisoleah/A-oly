import { env } from "@/lib/env";
import { verifyHmac } from "@/lib/payments/hmac";
import type {
  Intent,
  OrderForPayment,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/provider";

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
   * Verify a Paymob webhook. The HMAC is computed over the concatenation of the
   * documented fields in Paymob's published order. We rebuild that string here
   * and compare timing-safe; any mismatch throws.
   *
   * The exact field order MUST match Paymob's docs — pin it and re-verify before
   * go-live against a live sandbox callback.
   */
  async verifyWebhook(req: Request): Promise<VerifiedEvent> {
    const body = (await req.text()) as string;
    const obj = JSON.parse(body) as Record<string, unknown>;
    const hmacHeader = req.headers.get("x-paymob-hmac") ?? "";

    // Paymob's HMAC is computed over a specific ordered concatenation of fields.
    // Reconstruct from the documented key list; missing fields default to "".
    const HMAC_FIELDS = [
      "order", "amount_cents", "created_at", "currency", "error_occured",
      "has_parent_transaction", "id", "integration_id", "is_3d_secure",
      "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
      "is_voided", "owner", "pending", "source_data_pan", "source_data_sub_type",
      "source_data_type", "success",
    ];
    const message = HMAC_FIELDS.map((k) => String(obj[k] ?? "")).join("");
    if (!verifyHmac(env.PAYMOB_HMAC_SECRET!, message, hmacHeader)) {
      throw new Error("Paymob webhook HMAC verification failed.");
    }

    // Map to our canonical VerifiedEvent.
    const success = obj.success === true;
    const orderObj = obj.order as { id?: string; merchant_order_id?: string; extras?: { order_number?: string } } | string;
    const orderRef =
      (typeof orderObj === "object" ? orderObj?.extras?.order_number : undefined) ??
      (typeof orderObj === "object" ? String(orderObj?.id ?? "") : String(orderObj ?? ""));

    return {
      orderRef,
      eventKey: `paymob_${obj.id}`, // dedupe on the Paymob transaction id
      type: success ? "payment.succeeded" : "payment.failed",
      amount: Number(obj.amount_cents ?? 0),
      currency: String(obj.currency ?? "EGP"),
      providerRef: String(obj.id ?? ""),
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
