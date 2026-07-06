import { MockPayClient } from "@/app/mock-pay/[ref]/client";

/**
 * /mock-pay/[ref] — the MockPaymentProvider's hosted-checkout stand-in.
 *
 * In dev/test (PAYMENT_PROVIDER=mock), the checkout redirects here instead of
 * Paymob. The test customer clicks "Pay (succeed)" or "Fail", which POSTs a
 * correctly-signed fake webhook to /api/webhooks/mock — exercising the same
 * HMAC-verify + dedupe + PAID-transition path the real provider uses.
 *
 * Never rendered in production (mock provider is dev-only).
 */
export default async function MockPayPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  return (
    <div className="container-brand section-y">
      <div className="mx-auto max-w-md">
        <p className="text-meta mb-3">Mock payment — dev/test only</p>
        <h1 className="font-display text-3xl mb-4 lowercase">confirm your payment</h1>
        <p className="text-ink-soft mb-8 text-sm">
          This is a test checkout. Choose an outcome to simulate the payment result.
          A signed webhook is sent to the order webhook.
        </p>
        <MockPayClient ref_={ref} />
      </div>
    </div>
  );
}
