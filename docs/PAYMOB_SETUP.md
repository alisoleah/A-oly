# Paymob Integration — Sandbox Setup Guide

This is the step-by-step for getting real (sandbox) card payments working on aïoly.
Before you start: the code is now correct (SHA-512 HMAC, `?hmac=` query param,
canonical field order — all pinned by `tests/unit/paymob-hmac.test.ts`). The only
thing left is **wiring your Paymob sandbox credentials** and running the manual
checklist in `TESTING_GUIDE.md`.

> Scope reminder: card data never touches our servers. The customer is redirected
> to Paymob's hosted checkout. This keeps us out of PCI SAQ-D scope.

---

## 1. Create a Paymob sandbox account

1. Go to **https://accept.paymob.com** (Egypt) or
   **https://international.paymob.com** (international portal — which our code
   uses: `baseUrl = https://international.paymob.com/v1`).
2. Sign up for a **sandbox/test** account (free, instant).
   You'll get a **Merchant ID**.
3. From **Dashboard → Settings → Account Info → API Key**, copy the **API Key**.

```
PAYMOB_API_KEY=<paste here>
```

## 2. Get the HMAC secret (the webhook signing secret)

This is the most security-critical credential — it's what lets us verify that an
incoming "you got paid" callback is genuinely from Paymob and not an attacker.

1. Dashboard → **Settings** → **Webhook** (or *Developer Settings → HMAC*).
2. Copy the **HMAC Secret** (sometimes labeled "Account HMAC Key").
3. **Register your webhook URL** as:
   ```
   https://<YOUR_DEPLOYED_URL>/api/webhooks/paymob
   ```
   - For Vercel preview: `https://a-ndn5l1m8c-galalas-projects.vercel.app/api/webhooks/paymob`
   - For production domain: `https://<your-domain>/api/webhooks/paymob`
4. Make sure the webhook events you subscribe to include **TRANSACTION**
   (success + failure). Our verifier reads the `obj` of a TRANSACTION callback.

```
PAYMOB_HMAC_SECRET=<paste here>
```

> ⚠️ **Never** commit this to git. It goes only in:
> - `.env` locally (gitignored), and
> - **Vercel → Project → Settings → Environment Variables** for deployed envs.

## 3. Enable card integration & get the integration ID

1. Dashboard → **Payment Methods** (or *Accept → Integrations*).
2. Enable **Card** (and optionally **KNET / Apple Pay / Google Pay** if shown —
   Paymob's unified checkout surfaces wallet buttons automatically when the
   device supports them).
3. Each integration has an ID (e.g. `1234`). If you enable multiple, list them
   comma-separated.

```
PAYMOB_INTEGRATION_ID=1234
# multiple: PAYMOB_INTEGRATION_ID=1234,5678
```

## 4. Get the iframe ID

1. Dashboard → **Integrations** → the card integration → **iframe URL**.
   Paymob gives you an iframe ID (numeric) used to render the hosted card form.
2. Copy the numeric ID.

```
PAYMOB_IFRAME_ID=12345
```

## 5. Wire the credentials

### Locally (to test against sandbox from your machine)
Edit `.env` (gitignored):
```bash
PAYMENT_PROVIDER=paymob
PAYMOB_API_KEY=...        # from step 1
PAYMOB_HMAC_SECRET=...    # from step 2
PAYMOB_INTEGRATION_ID=... # from step 3
PAYMOB_IFRAME_ID=...      # from step 4
APP_BASE_URL=http://localhost:3000
```

### On Vercel (so the deployed app uses sandbox)
**Vercel → Project → Settings → Environment Variables**, add the same five
variables (raw values — Vercel does not do `$` expansion, unlike dotenv).

### Critical: register the webhook URL in Paymob dashboard
Paymob must POST to **`https://<deployed-url>/api/webhooks/paymob`**. Without
this, payments succeed on Paymob's side but our order never transitions to PAID.
Use the Vercel deployment URL (not localhost — Paymob can't reach localhost).

## 6. Switch the provider flag
- Dev/test with no keys: `PAYMENT_PROVIDER=mock` (default).
- Sandbox or live: `PAYMENT_PROVIDER=paymob`.

`src/lib/env.ts` enforces that all four Paymob keys are present when
`PAYMENT_PROVIDER=paymob` — the app fails closed at boot if any are missing.

---

## Verifying the HMAC wiring (sanity check)

The moment you wire sandbox keys, run this to confirm the verifier matches real
Paymob signatures:

1. Complete a sandbox purchase with a Paymob **test card**:
   - Visa: `4111 1111 1111 1111`, any future expiry, any CVV.
   - Mastercard: `5123 4500 0000 0008`.
2. Open Paymob dashboard → **Transactions** → find the txn → view the callback
   payload + the `hmac` query param Paymob sent.
3. Confirm our webhook endpoint returned `200 { ok: true }` (Vercel logs).
4. Confirm the order in `/admin` is **PAID** (not stuck in PENDING_PAYMENT).

If the webhook returns 401 "invalid signature", the HMAC configuration is wrong.
The most common causes:
- **Wrong secret** — PAYMOB_HMAC_SECRET doesn't match the dashboard's HMAC key.
- **Wrong URL registered** — webhook posted somewhere other than
  `/api/webhooks/paymob`.
- **Field list drift** — Paymob changed their callback schema. Re-verify against
  their docs and update `HMAC_FIELDS` in `src/lib/payments/paymob-provider.ts`
  (the unit test in `tests/unit/paymob-hmac.test.ts` will flag the change).

## Test cards (Paymob sandbox)
| Brand | PAN | Result |
|-------|-----|--------|
| Visa | `4111 1111 1111 1111` | success |
| Mastercard | `5123 4500 0000 0008` | success |
| Visa | `4000 0000 0000 0002` | decline |
| Visa | `5123 4500 0000 0016` | insufficient funds |

CVV and expiry can be any valid future value.

## Go-live checklist (before switching to PRODUCTION keys)
- [ ] All five Paymob env vars set in Vercel (production env, marked "Production").
- [ ] Webhook URL in Paymob dashboard = the **production** domain.
- [ ] At least one successful sandbox card purchase reaching PAID via webhook.
- [ ] Apple Pay button appears on Safari/iPhone (sandbox Apple Merchant ID set).
- [ ] Google Pay button appears on Chrome/Android.
- [ ] Refund test: mark an order refunded in `/admin` → reflects in Paymob.
- [ ] Credential rotation phase (Phase 6) complete: Supabase password, admin
      password, SESSION_SECRET all rotated before public launch.
