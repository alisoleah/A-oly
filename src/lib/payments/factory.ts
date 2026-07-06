import { env } from "@/lib/env";
import type { PaymentProvider } from "@/lib/payments/provider";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { PaymobProvider } from "@/lib/payments/paymob-provider";

/**
 * Provider factory — selects the active PaymentProvider from env.
 *
 * PAYMENT_PROVIDER=mock  → dev/test (full flow runnable without real keys)
 * PAYMENT_PROVIDER=paymob → production (env.ts asserts all keys are present)
 *
 * A second Gulf provider slots in here later (Phase 7) without touching any
 * checkout code — that's the whole point of the seam.
 */
let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  _provider =
    env.PAYMENT_PROVIDER === "paymob" ? new PaymobProvider() : new MockPaymentProvider();
  return _provider;
}

/** Reset the cached provider (tests that swap env). */
export function resetPaymentProvider(): void {
  _provider = null;
}
