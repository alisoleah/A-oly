import { env } from "@/lib/env";
import type { PaymentProvider } from "@/lib/payments/provider";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { PaymobProvider } from "@/lib/payments/paymob-provider";
import { FawryProvider } from "@/lib/payments/fawry-provider";
import { TwoCTwoPProvider } from "@/lib/payments/two-c-two-p-provider";

/**
 * Provider factory — selects the active PaymentProvider from env.
 *
 * PAYMENT_PROVIDER=mock   → dev/test (full flow runnable without real keys)
 * PAYMENT_PROVIDER=2c2p   → production 2C2P (cards + Apple Pay + Google Pay)
 * PAYMENT_PROVIDER=fawry  → production FawryPay (cards + wallets + cash network)
 * PAYMENT_PROVIDER=paymob → production Paymob (placeholder — activate when ready)
 *
 * A second Gulf provider (Tap, HyperPay, etc.) slots in here later (Phase 7)
 * without touching any checkout code — that's the whole point of the seam.
 */
let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;
  switch (env.PAYMENT_PROVIDER) {
    case "2c2p":
      _provider = new TwoCTwoPProvider();
      break;
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
