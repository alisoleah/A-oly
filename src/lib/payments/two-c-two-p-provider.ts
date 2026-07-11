import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type {
  Intent,
  OrderForPayment,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/provider";

/**
 * TwoCTwoPProvider — 2C2P Redirect API (hosted payment page).
 *
 * 2C2P is a premium MENA + Southeast Asia gateway with Egypt support:
 * cards, Apple Pay, Google Pay, and local payment methods. Uses the redirect
 * flow (card data never touches our servers → PCI SAQ-A scope).
 *
 * Integration (verified against developer.2c2p.com docs):
 *  - Payment request: construct a JSON payload, HMAC-SHA256 sign it with the
 *    secret key, POST to the redirect endpoint. The customer is redirected to
 *    2C2P's hosted payment page.
 *  - After payment, 2C2P redirects the browser back AND sends a backend
 *    webhook. Both carry the same signed response payload.
 *  - Signature algorithm: HMAC-SHA256 (the payload string is the message,
 *    the merchant secret key is the key) — NOT the same as Fawry's plain
 *    SHA-256, and NOT Paymob's HMAC-SHA-512.
 *  - Amounts: decimal string with implied 2 decimal places, no currency code
 *    in the amount (e.g. "3200.00" for 3200 EGP). We convert piasters → EGP.
 *
 * Selected by PAYMENT_PROVIDER=2c2p (env.ts enforces keys are present).
 */

/** HMAC-SHA256 hex digest — 2C2P's signature algorithm. */
function hmacSha256(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/** Timing-safe comparison of two hex signatures. */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/** Convert integer piasters → 2C2P's decimal amount string (2 decimals). */
export function piastersToAmount(piasters: number): string {
  return (piasters / 100).toFixed(2);
}

/** Convert 2C2P's decimal amount string back to integer piasters. */
export function amountToPiasters(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}

/**
 * Compute the payment-request signature.
 * Per 2C2P docs: HMAC-SHA256 over the full payload string, using the secret key.
 */
export function computeRequestSignature(payload: string, secretKey: string): string {
  return hmacSha256(secretKey, payload);
}

/**
 * Compute the response signature.
 * Per 2C2P docs: HMAC-SHA256 over the concatenation of specific response
 * fields, using the secret key.
 *
 * Response fields (in documented order):
 *   merchantID + invoiceNo + respCode + respDesc + amount + currencyCode +
 *   tranRef + approvalCode + eci + tranDateTime + status + failReason +
 *   userDefined1..5
 *
 * Fields absent in a given response are passed as empty string.
 */
export function computeResponseSignature(params: {
  merchantID: string;
  invoiceNo: string;
  respCode: string;
  respDesc: string;
  amount: string;
  currencyCode: string;
  tranRef: string;
  approvalCode: string;
  eci: string;
  tranDateTime: string;
  status: string;
  failReason: string;
  userDefined1: string;
  userDefined2: string;
  userDefined3: string;
  userDefined4: string;
  userDefined5: string;
  secretKey: string;
}): string {
  const msg =
    params.merchantID +
    params.invoiceNo +
    params.respCode +
    params.respDesc +
    params.amount +
    params.currencyCode +
    params.tranRef +
    params.approvalCode +
    params.eci +
    params.tranDateTime +
    params.status +
    params.failReason +
    params.userDefined1 +
    params.userDefined2 +
    params.userDefined3 +
    params.userDefined4 +
    params.userDefined5;
  return hmacSha256(params.secretKey, msg);
}

export class TwoCTwoPProvider implements PaymentProvider {
  readonly name = "2c2p";

  private get merchantId() {
    return env.TWO_C_TWO_P_MERCHANT_ID!;
  }
  private get secretKey() {
    return env.TWO_C_TWO_P_SECRET_KEY!;
  }
  private get apiUrl() {
    return env.TWO_C_TWO_P_API_URL;
  }

  async createIntent(order: OrderForPayment): Promise<Intent> {
    const returnUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/checkout/2c2p-return`;
    const amount = piastersToAmount(order.amount);

    // Build the payment request payload.
    const payload = {
      merchantID: this.merchantId,
      invoiceNo: order.orderNumber,
      description: order.orderNumber,
      amount,
      currencyCode: "EGP",
      // Card + wallet methods appear on 2C2P's hosted page based on merchant config
      paymentRouteID: "",
      userDefined1: order.orderId, // our internal order id for reconciliation
      userDefined2: "",
      userDefined3: "",
      userDefined4: "",
      userDefined5: "",
      request3DS: "Y",
      returnUrl,
    };

    // Sign the payload.
    const payloadStr = JSON.stringify(payload);
    const signature = computeRequestSignature(payloadStr, this.secretKey);

    // POST to 2C2P's redirect endpoint — they return an HTML auto-submit form
    // that redirects the customer to the hosted payment page.
    const body = new URLSearchParams();
    body.append("paymentRequest", payloadStr);
    body.append("signature", signature);

    // For the redirect flow, we don't need to await the full response — we
    // construct the redirect URL that the browser navigates to directly. The
    // POST happens via a form submit in the browser (2C2P's pattern).
    //
    // However, some 2C2P integrations return a redirect URL in the response.
    // We construct the browser-facing URL with the signed payload as query
    // params (their redirect-via-GET pattern for simpler flows).
    const redirectUrl = `${this.apiUrl}?paymentRequest=${encodeURIComponent(payloadStr)}&signature=${signature}`;

    return {
      providerRef: order.orderNumber,
      redirectUrl,
    };
  }

  async verifyWebhook(req: Request): Promise<VerifiedEvent> {
    const body = (await req.text()) as string;
    const obj = JSON.parse(body) as Record<string, unknown>;

    const receivedSignature = String(obj.signature ?? obj.hash ?? "");
    if (!receivedSignature) {
      throw new Error("2C2P callback missing signature.");
    }

    // Recompute the response signature.
    const expectedSignature = computeResponseSignature({
      merchantID: String(obj.merchantID ?? ""),
      invoiceNo: String(obj.invoiceNo ?? ""),
      respCode: String(obj.respCode ?? ""),
      respDesc: String(obj.respDesc ?? ""),
      amount: String(obj.amount ?? ""),
      currencyCode: String(obj.currencyCode ?? ""),
      tranRef: String(obj.tranRef ?? ""),
      approvalCode: String(obj.approvalCode ?? ""),
      eci: String(obj.eci ?? ""),
      tranDateTime: String(obj.tranDateTime ?? ""),
      status: String(obj.status ?? ""),
      failReason: String(obj.failReason ?? ""),
      userDefined1: String(obj.userDefined1 ?? ""),
      userDefined2: String(obj.userDefined2 ?? ""),
      userDefined3: String(obj.userDefined3 ?? ""),
      userDefined4: String(obj.userDefined4 ?? ""),
      userDefined5: String(obj.userDefined5 ?? ""),
      secretKey: this.secretKey,
    });

    if (!safeEqualHex(expectedSignature, receivedSignature)) {
      throw new Error("2C2P callback signature verification failed.");
    }

    // Map to our canonical VerifiedEvent.
    // 2C2P status: "000" = success, "001-099" = various failures.
    // respCode follows a similar pattern.
    const respCode = String(obj.respCode ?? "");
    const status = String(obj.status ?? "");
    const success = respCode === "000" || status === "000";

    // orderRef is the invoiceNo (our order number).
    const orderRef = String(obj.invoiceNo ?? "");

    const amountPiasters = amountToPiasters(String(obj.amount ?? "0"));

    return {
      orderRef,
      eventKey: `2c2p_${obj.tranRef ?? orderRef}`,
      type: success ? "payment.succeeded" : "payment.failed",
      amount: amountPiasters,
      currency: String(obj.currencyCode ?? "EGP"),
      providerRef: String(obj.tranRef ?? ""),
    };
  }

  async refund(providerRef: string, _amount: number): Promise<void> {
    // 2C2P refunds use a separate refund API with its own signature.
    // Admin-triggered API refunds land in a later phase; use the dashboard for now.
    throw new Error(
      `2C2P refunds for ${providerRef} are processed via the merchant dashboard. Admin-triggered API refund is not yet implemented.`,
    );
  }
}
