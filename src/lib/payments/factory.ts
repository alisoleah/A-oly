import { env } from "@/lib/env";
import type { PaymentProvider } from "@/lib/payments/provider";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { PaymobProvider } from "@/lib/payments/paymob-provider";
import { FawryProvider } from "@/lib/payments/fawry-provider";

/**
 * Provider factory — selects the active PaymentProvider from env.
 *
 * PAYMENT_PROVIDER=mock   → dev/test (full flow runnable without real keys)
 * PAYMENT_PROVIDER=fawry  → production FawryPay (env.ts asserts keys present)
 * PAYMENT_PROVIDER=paymob → production Paymob (keys present) — placeholder,
 *                           activate when Paymob login is restored
 *
 * A second Gulf provider (Tap, HyperPay, etc.) slots in here later (Phase 7)
 * without touching any checkout code — that's the whole point of the seam.
 */
let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  switch (env.PAYMENT_PROVIDER) {
    case "fawry":
      _provider = new FawryProvider();
      break;
    case "paymob":
      _provider = new PaymobProvider();
      break;
    default:
      _provider = new MockPaymentProvider();
  }
  return _provider;
}

/** Reset the cached provider (tests that swap env). */
export function resetPaymentProvider(): void {
  _provider = null;
}
