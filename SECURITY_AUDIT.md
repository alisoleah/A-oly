# SECURITY_AUDIT — aïoly storefront

Defensive audit of our own codebase, per `claude-code-security-testing-prompt.md`.
Run before every major release.

## Threat model

Next.js 15 App Router storefront. Money in integer piasters. Payments: Paymob
(card/Apple Pay/Google Pay) behind a `PaymentProvider` interface + Cash on
Delivery. Card data never touches our servers (hosted checkout/redirect) →
out of PCI SAQ-D scope. Admin is single-credential via env.

**Crown jewels, in order:**
1. Order/payment integrity — stock/totals/PAID transitions must be unforgeable.
2. Customer PII — names, phones, addresses on orders.
3. Admin access — the single env credential.
4. Availability during launch — checkout + webhook must survive floods.

## Findings table

| ID | Sev | Area | Finding | Status |
|----|-----|------|---------|--------|
| A1 | — | Payment | Webhook HMAC compared timing-safe (`crypto.timingSafeEqual`); fails closed on mismatch. `lib/payments/hmac.ts` | ✅ control exists |
| A2 | — | Payment | The ONLY non-webhook path to PAID is `admin_mark_paid` (PENDING_COD → PAID, admin-only, courier-collected COD). No code path sets an online order to PAID outside the webhook. | ✅ control exists (by design) |
| A3 | — | Payment | Amount compared against order total before PAID; mismatch flagged + rejected. | ✅ control exists |
| A4 | — | Payment | Webhook deduped on `PaymentEvent.eventKey` (UNIQUE); replay is a no-op. | ✅ control exists |
| A5 | — | Payment | Public confirmation page keyed on unguessable `confirmToken` (256-bit), not order number. | ✅ control exists |
| B1 | LOW | Injection | Two `dangerouslySetInnerHTML` uses render `JSON.stringify(jsonLd)` for the product JSON-LD blob. Data is admin-authored catalog content, not request input. | ✅ accepted (LOW) |
| B2 | — | Injection | The single `$executeRaw` (atomic stock decrement) is fully parameterized via tagged-template. No `$queryRaw`, no interpolation. | ✅ control exists |
| B3 | — | Injection | Every API route + server action Zod-parses input before use. | ✅ control exists |
| C1 | — | AuthZ | Middleware matcher covers `/admin/:path*` + `/api/admin/:path*`. JWT re-verified per request. | ✅ control exists |
| C2 | — | AuthN | Session cookie: httpOnly, Secure (prod), SameSite=lax, signed HS256 JWT. | ✅ control exists |
| C3 | — | AuthN | Login rate-limited (5/15min). No user enumeration. | ✅ control exists |
| D1 | — | Secrets | No `NEXT_PUBLIC_` vars hold secrets. | ✅ control exists |
| D2 | — | Secrets | `env.ts` fails closed at boot on missing/invalid required vars. | ✅ control exists |
| D3 | — | Secrets | No stack traces to clients (custom error.tsx). | ✅ control exists |
| E1 | — | Headers | CSP, HSTS (1yr+preload), X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy on all responses. | ✅ control exists |
| E2 | — | Platform | Rate limiting on checkout (20/10min), webhook (60/min), login (5/15min). In-memory; upgrade path in RUNBOOK. | ✅ control exists (note) |
| F1 | — | Privacy | Webhook `rawPayload` masked to the minimum fulfilment fields. | ✅ control exists |
| F2 | — | Privacy | Confirmation page requires the emailed token; noindex. Data export/erasure procedure in RUNBOOK. | ✅ control exists |
| L1 | LOW | Platform | Cron secret compared timing-safe (`safeEqualHex`). | ✅ fixed |
| L2 | LOW | Privacy | `/api/mock-pay/resolve` returns a confirmToken from an order id. Dev/test only — gated by `PAYMENT_PROVIDER=mock`. | ✅ accepted (dev-only) |

## HIGH findings = 0 · MEDIUM findings = 0

## Re-run instructions
1. Re-execute audit areas A–F against `src/` after any change touching payments,
   auth, input handling, or headers.
2. Security-critical invariants are covered by regression tests:
   - `tests/unit/hmac.test.ts`, `tests/integration/webhook.test.ts`,
     `tests/integration/checkout.concurrency.test.ts`, `tests/e2e/admin.spec.ts`
3. Run `npm audit` periodically; fix criticals/highs.
