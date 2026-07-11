import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  Intent,
  OrderForPayment,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/provider";

/**
 * FawryProvider — the production provider using FawryPay's Hosted Checkout API.
 *
 * FawryPay is Egypt's dominant payment network: cards, mobile wallets, and cash
 * payment at 250k+ Fawry retail outlets. This provider uses the redirect/hosted
 * checkout flow (card data never touches our servers → PCI SAQ-A scope).
 *
 * Integration (verified against developer.fawrystaging.com docs):
 *  - createIntent: POST a charge request → Fawry returns a checkout redirect URL.
 *  - After payment, Fawry redirects the customer to our returnUrl AND fires a
 *    server-to-server callback. Both carry a SHA-256 signature we verify.
 *  - Amounts are decimal EGP (e.g. "580.55"), NOT integer cents. We convert
 *    piasters → EGP at the boundary (formatPrice without currency label, or
 *    manual /100 with 2 decimals).
 *  - Signature: SHA-256 over a concatenation of specific fields + secureKey.
 *
 * Selected by PAYMENT_PROVIDER=fawry (env.ts enforces keys are present).
 */

/** SHA-256 hex digest helper — Fawry's signature algorithm (NOT HMAC, plain hash). */
function sha256(message: string): string {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

/**
 * Convert integer piasters → Fawry's decimal EGP string (2 decimals, no commas).
 * e.g. 58055 → "580.55", 320000 → "3200.00"
 */
export function piastersToEgp(piasters: number): string {
  return (piasters / 100).toFixed(2);
}

/**
 * Compute the charge-request signature.
 *
 * Per Fawry docs: SHA-256(merchantCode + merchantRefNum + customerProfileId +
 * returnUrl + itemId + quantity + price + secureKey)
 * Fields with no value are passed as empty string in the concatenation.
 */
export function computeChargeSignature(params: {
  merchantCode: string;
  merchantRefNum: string;
  customerProfileId: string;
  returnUrl: string;
  itemId: string;
  quantity: string;
  price: string;
  secureKey: string;
}): string {
  const msg =
    params.merchantCode +
    params.merchantRefNum +
    params.customerProfileId +
    params.returnUrl +
    params.itemId +
    params.quantity +
    params.price +
    params.secureKey;
  return sha256(msg);
}

/**
 * Compute the response/callback signature.
 *
 * Per Fawry docs: SHA-256 over the concatenation of these response fields
 * (in this exact order), with conditional fields skipped if absent:
 *   referenceNumber + merchantRefNum + paymentAmount + orderAmount +
 *   orderStatus + paymentMethod + fawryFees + shippingFees + authNumber +
 *   customerMail + customerMobile + secureKey
 *
 * IMPORTANT: the order MUST match Fawry's documented field order. A different
 * order = a different digest = every callback rejected.
 */
export function computeResponseSignature(params: {
  referenceNumber: string;
  merchantRefNum: string;
  paymentAmount: string;
  orderAmount: string;
  orderStatus: string;
  paymentMethod: string;
  fawryFees: string;
  shippingFees: string;
  authNumber: string;
  customerMail: string;
  customerMobile: string;
  secureKey: string;
}): string {
  const msg =
    params.referenceNumber +
    params.merchantRefNum +
    params.paymentAmount +
    params.orderAmount +
    params.orderStatus +
    params.paymentMethod +
    params.fawryFees +
    params.shippingFees +
    params.authNumber +
    params.customerMail +
    params.customerMobile +
    params.secureKey;
  return sha256(msg);
}

/**
 * Timing-safe comparison of two hex digests.
 * Reuses the same safe-compare pattern as the Paymob HMAC verifier.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

export class FawryProvider implements PaymentProvider {
  readonly name = "fawry";

  private get merchantCode() {
    return env.FAWRY_MERCHANT_CODE!;
  }
  private get secureKey() {
    return env.FAWRY_SECURE_KEY!;
  }
  private get apiUrl() {
    return env.FAWRY_API_URL;
  }

  async createIntent(order: OrderForPayment): Promise<Intent> {
    const merchantRefNum = order.orderNumber;
    const returnUrl =
      env.FAWRY_RETURN_URL ??
      `${env.APP_BASE_URL.replace(/\/$/, "")}/checkout/fawry-return`;

    // Fawry requires at least one charge item. We send a single line for the
    // full amount (line items can be enriched later for richer receipts).
    const itemId = "order";
    const quantity = "1";
    const price = piastersToEgp(order.amount);

    const signature = computeChargeSignature({
      merchantCode: this.merchantCode,
      merchantRefNum,
      customerProfileId: order.email, // use email as profile id
      returnUrl,
      itemId,
      quantity,
      price,
      secureKey: this.secureKey,
    });

    const body = {
      merchantCode: this.merchantCode,
      merchantRefNum,
      customerProfileId: order.email,
      customerName: order.firstName,
      customerMobile: order.phone,
      customerEmail: order.email,
      amount: price,
      currencyCode: order.currency,
      // 3 + Charge: cards + wallets + cash at Fawry outlets
      chargeItems: [{ itemId, description: order.orderNumber, price, quantity }],
      signature,
      returnUrl,
      paymentExpiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const res = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Fawry charge request failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      type: string;
      referenceNumber?: string;
      merchantRefNumber?: string;
      statusCode?: string;
      statusDescription?: string;
      redirectUrl?: string;
      // The callback URL or redirect may carry the redirect directly
      nextAction?: { type?: string; redirectUrl?: string };
    };

    // Fawry returns either a redirectUrl directly or instructs to navigate
    // to the hosted checkout. The typical response includes a redirect URL.
    const redirectUrl =
      data.redirectUrl ??
      data.nextAction?.redirectUrl ??
      // Fallback: some Fawry responses require constructing the checkout URL
      `https://www.fawrystaging.com/ECommercePlugin/checkout?merchantCode=${this.merchantCode}&merchantRefNumber=${merchantRefNum}`;

    const providerRef = data.referenceNumber ?? merchantRefNum;

    return {
      providerRef,
      redirectUrl,
    };
  }

  async verifyWebhook(req: Request): Promise<VerifiedEvent> {
    const body = (await req.text()) as string;
    const obj = JSON.parse(body) as Record<string, unknown>;

    // Fawry sends the signature in the "signature" field of the callback.
    const receivedSignature = String(obj.signature ?? "");
    if (!receivedSignature) {
      throw new Error("Fawry callback missing signature.");
    }

    // Recompute the signature from the callback fields.
    const expectedSignature = computeResponseSignature({
      referenceNumber: String(obj.referenceNumber ?? ""),
      merchantRefNum: String(obj.merchantRefNum ?? ""),
      paymentAmount: String(obj.paymentAmount ?? ""),
      orderAmount: String(obj.orderAmount ?? ""),
      orderStatus: String(obj.orderStatus ?? ""),
      paymentMethod: String(obj.paymentMethod ?? ""),
      fawryFees: String(obj.fawryFees ?? ""),
      shippingFees: String(obj.shippingFees ?? ""),
      authNumber: String(obj.authNumber ?? ""),
      customerMail: String(obj.customerMail ?? ""),
      customerMobile: String(obj.customerMobile ?? ""),
      secureKey: this.secureKey,
    });

    if (!safeEqualHex(expectedSignature, receivedSignature)) {
      throw new Error("Fawry callback signature verification failed.");
    }

    // Map to our canonical VerifiedEvent.
    const status = String(obj.orderStatus ?? "").toUpperCase();
    const success = status === "PAID" || status === "NEW";
    const orderRef = String(obj.merchantRefNum ?? "");

    // Fawry amounts are decimal EGP string → convert back to piasters.
    const amountEgp = parseFloat(String(obj.orderAmount ?? "0"));
    const amountPiasters = Math.round(amountEgp * 100) as VerifiedEvent["amount"];

    return {
      orderRef,
      eventKey: `fawry_${obj.referenceNumber ?? orderRef}`,
      type: success ? "payment.succeeded" : "payment.failed",
      amount: amountPiasters,
      currency: "EGP",
      providerRef: String(obj.referenceNumber ?? ""),
    };
  }

  async refund(_providerRef: string, _amount: number): Promise<void> {
    // Fawry refunds are via dashboard or a separate refund API endpoint.
    // Admin-triggered refunds through this seam land in a later phase.
    throw new Error(
      "Fawry refunds are processed via the merchant dashboard. Admin-triggered API refund is not yet implemented.",
    );
  }
}
