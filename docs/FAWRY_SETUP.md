# FawryPay Integration — Sandbox Setup Guide

FawryPay is Egypt's dominant payment network: cards, mobile wallets, and cash
payment at 250k+ Fawry retail outlets. This is the **active provider** for the
storefront. Paymob is wired as a placeholder for later activation.

> Scope: card data never touches our servers. The customer is redirected to
> FawryPay's hosted checkout. PCI SAQ-A scope.

---

## 1. Create a FawryPay account

1. Go to **https://developer.fawrystaging.com** (sandbox) or contact FawryPay
   business team for a production merchant account.
2. Register your business. You'll receive:
   - **Merchant Code** (identifies your store)
   - **Secure Key** (the signing secret for request/response verification)

```
FAWRY_MERCHANT_CODE=<your merchant code>
FAWRY_SECURE_KEY=<your secure key>
```

## 2. Set the API URL

- **Sandbox (testing):** `https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/charge`
- **Production (live):** `https://www.atfawry.com/ECommerceWeb/Fawry/payments/charge`

The sandbox URL is the default. Switch to production when going live.

## 3. Configure the webhook / return URL

FawryPay redirects the customer back to your site after payment AND sends a
server-to-server callback. Both must be handled.

1. Set `FAWRY_RETURN_URL` to your deployed return page:
   ```
   FAWRY_RETURN_URL=https://your-domain.vercel.app/checkout/fawry-return
   ```
2. Register the **server callback URL** in the FawryPay dashboard:
   ```
   https://your-domain.vercel.app/api/webhooks/fawry
   ```
3. The callback carries a SHA-256 signature (not HMAC — plain hash of
   concatenated fields + your secure key). Our verifier checks it timing-safe.

## 4. Wire the credentials

### Locally (`.env`, gitignored)
```bash
PAYMENT_PROVIDER=fawry
FAWRY_MERCHANT_CODE=...        # from step 1
FAWRY_SECURE_KEY=...           # from step 1
FAWRY_API_URL=https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/charge
FAWRY_RETURN_URL=http://localhost:3000/checkout/fawry-return
```

### On Vercel (Project → Settings → Environment Variables)
Add the same variables with the deployed URL.

## 5. Activate

Set `PAYMENT_PROVIDER=fawry` — `src/lib/env.ts` enforces that
`FAWRY_MERCHANT_CODE` + `FAWRY_SECURE_KEY` are present (fails closed at boot if
missing).

## Testing

FawryPay sandbox provides test cards and methods. After wiring keys:

1. Complete a sandbox purchase — the customer is redirected to FawryPay's hosted
   checkout.
2. Confirm the webhook endpoint returns `200 { ok: true }` (Vercel logs).
3. Confirm the order in `/admin` is **PAID** (not stuck in PENDING_PAYMENT).

If the webhook returns 401 "invalid signature", check:
- **FAWRY_SECURE_KEY** matches the dashboard's secure key
- The webhook URL in the dashboard = `https://your-domain/api/webhooks/fawry`
- Field order drift (Fawry changed their callback schema) — re-verify against
  their docs and update `computeResponseSignature` in `fawry-provider.ts`

## Signature contract (pinned by tests)

| Direction | Algorithm | Fields (in order) |
|-----------|-----------|-------------------|
| **Charge request** | SHA-256 | merchantCode + merchantRefNum + customerProfileId + returnUrl + itemId + quantity + price + secureKey |
| **Response/callback** | SHA-256 | referenceNumber + merchantRefNum + paymentAmount + orderAmount + orderStatus + paymentMethod + fawryFees + shippingFees + authNumber + customerMail + customerMobile + secureKey |

Tests: `tests/unit/fawry-signature.test.ts` (12 tests pin the algorithm +
field order + tamper detection).

## Refunds

FawryPay refunds are processed via the merchant dashboard. The
`FawryProvider.refund()` method is a stub that throws — admin-triggered API
refunds land in a later phase.
