# 2C2P Integration — Sandbox Setup Guide

2C2P is a premium MENA + Southeast Asia payment gateway with Egypt support.
It offers **cards, Apple Pay, and Google Pay** — the wallet payment methods
that Fawry doesn't support. This makes it the strongest provider for a premium
fashion brand in Egypt.

> Scope: card data never touches our servers. The customer is redirected to
> 2C2P's hosted payment page. PCI SAQ-A scope.

---

## 1. Create a 2C2P account

1. Contact 2C2P's business team or register at **https://www.2c2p.com**.
2. After approval you'll receive:
   - **Merchant ID** (identifies your store)
   - **Secret Key** (the HMAC-SHA256 signing key)

```
TWO_C_TWO_P_MERCHANT_ID=<your merchant id>
TWO_C_TWO_P_SECRET_KEY=<your secret key>
```

## 2. Set the API URL

- **Staging (sandbox):** `https://demo2.2c2p.com/2C2PFrontEnd/RedirectPayment.htm`
- **Production (live):** `https://t.2c2p.com/2C2PFrontEnd/RedirectPayment.htm`

Staging is the default. Switch to production when going live.

## 3. Configure the return URL + webhook

2C2P redirects the customer back to your site AND sends a backend webhook.
Both carry the same HMAC-SHA256 signed payload.

1. **Return URL** (customer redirect after payment):
   ```
   https://your-domain.vercel.app/checkout/2c2p-return
   ```
   This is auto-constructed from `APP_BASE_URL` — just make sure `APP_BASE_URL`
   is set correctly in Vercel env vars.

2. **Backend webhook URL** (register in the 2C2P dashboard):
   ```
   https://your-domain.vercel.app/api/webhooks/2c2p
   ```

## 4. Wire the credentials

### Locally (`.env`, gitignored)
```bash
PAYMENT_PROVIDER=2c2p
TWO_C_TWO_P_MERCHANT_ID=...      # from step 1
TWO_C_TWO_P_SECRET_KEY=...       # from step 1
TWO_C_TWO_P_API_URL=https://demo2.2c2p.com/2C2PFrontEnd/RedirectPayment.htm
```

### On Vercel (Project → Settings → Environment Variables)
Add the same variables with the deployed URL.

## 5. Activate

Set `PAYMENT_PROVIDER=2c2p` — `src/lib/env.ts` enforces that
`TWO_C_TWO_P_MERCHANT_ID` + `TWO_C_TWO_P_SECRET_KEY` are present.

## Signature contract (pinned by tests)

| Direction | Algorithm | Signed data |
|-----------|-----------|-------------|
| **Payment request** | HMAC-SHA256 | The full JSON payload string |
| **Response/callback** | HMAC-SHA256 | Concatenation of response fields in documented order |

Response field order: `merchantID + invoiceNo + respCode + respDesc + amount +
currencyCode + tranRef + approvalCode + eci + tranDateTime + status +
failReason + userDefined1..5`

Tests: `tests/unit/two-c-two-p-signature.test.ts` (pin the algorithm, field
order, tamper detection).

## Response codes

- `respCode === "000"` → success (order → PAID)
- `respCode === "001-099"` → various failures (order → CANCELLED)

## Testing

1. Complete a sandbox purchase — the customer redirects to 2C2P's hosted page.
2. Confirm the webhook returns `200 { ok: true }`.
3. Confirm the order in `/admin` is **PAID**.

If the webhook returns 401 "invalid signature":
- Verify `TWO_C_TWO_P_SECRET_KEY` matches the dashboard
- Check field order in `computeResponseSignature` against current 2C2P docs
- Run `tests/unit/two-c-two-p-signature.test.ts` to verify the contract

## Why 2C2P over Fawry

| Feature | 2C2P | Fawry |
|---------|:----:|:-----:|
| Cards | ✅ | ✅ |
| Apple Pay | ✅ | ❌ |
| Google Pay | ✅ | ❌ |
| Cash at retail outlets | ❌ | ✅ (250k+ locations) |
| Mobile wallets | Some | ✅ |

For a premium brand targeting online customers with cards + wallets,
**2C2P is the better fit**. Fawry's strength (cash network) suits COD-heavy
unbanked markets.
