import { env } from "@/lib/env";
import type {
  Intent,
  OrderForPayment,
  PaymentProvider,
  VerifiedEvent,
} from "@/lib/payments/provider";
import { verifyHmac } from "@/lib/payments/hmac";

/**
 * MockPaymentProvider — the dev/test provider (CLAUDE.md).
 *
 *  - createIntent returns a local /mock-pay/[ref] page where the (test) customer
 *    clicks "succeed" or "fail". No real money, no network.
 *  - The mock pay page POSTs a correctly-signed fake webhook to our own webhook
 *    endpoint, using the SAME HMAC verify path the real provider uses — so the
 *    security-critical signature logic is exercised end-to-end in tests.
 *  - The mock's HMAC secret is a dedicated MOCK_HMAC_SECRET (defaults to a fixed
 *    dev value), never the real Paymob secret.
 *
 * Selected by PAYMENT_PROVIDER=mock.
 */
const MOCK_SECRET = "mock-webhook-secret-for-dev-and-tests-only";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async createIntent(order: OrderForPayment): Promise<Intent> {
    const providerRef = `mock_${order.orderId}`;
    // The mock-pay page is keyed by this ref; it renders succeed/fail buttons
    // that POST the signed webhook back to /api/webhooks/mock.
    const base = env.APP_BASE_URL.replace(/\/$/, "");
    return {
      providerRef,
      redirectUrl: `${base}/mock-pay/${providerRef}`,
    };
  }

  async verifyWebhook(req: Request): Promise<VerifiedEvent> {
    const body = (await req.text()) as string;
    const signature = req.headers.get("x-mock-signature") ?? "";
    // The mock signs the raw body; this exercises the same timing-safe path.
    if (!verifyHmac(MOCK_SECRET, body, signature)) {
      throw new Error("Mock webhook signature verification failed.");
    }

    const payload = JSON.parse(body) as {
      orderRef: string;
      eventKey: string;
      type: VerifiedEvent["type"];
      amount: number;
      currency: string;
      providerRef: string;
    };

    return {
      orderRef: payload.orderRef,
      eventKey: payload.eventKey,
      type: payload.type,
      amount: payload.amount,
      currency: payload.currency,
      providerRef: payload.providerRef,
    };
  }

  async refund(_providerRef: string, _amount: number): Promise<void> {
    // No-op in mock; the audit log still records the attempt.
  }
}

/** The HMAC secret the mock pay page uses to sign its fake webhook. Exported
 *  for the mock-pay route so it can produce correctly-signed payloads. */
export const MOCK_HMAC_SECRET = MOCK_SECRET;
