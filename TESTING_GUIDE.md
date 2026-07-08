# aïoly storefront — TESTING GUIDE

Testing philosophy: the catalog can afford a visual bug; **money, stock, and order state cannot**. Test depth is proportional to blast radius.

## Stack & layout

- **Vitest** — unit + integration (integration hits a real test DB, not mocks of Prisma).
- **Playwright** — e2e against a seeded dev server with `PAYMENT_PROVIDER=mock`.
- Test DB: SQLite file per worker, `prisma migrate deploy` + seed in global setup, truncated between test files.
- CI order: `typecheck → lint → vitest → build → playwright`. A phase is done only when all five pass.

```
tests/
  unit/            # pure logic: money, validation, hmac, state machine
  integration/     # server actions & API routes against test DB
  e2e/             # Playwright user journeys
  load/            # k6/artillery script for checkout concurrency
```

## The critical invariants (must always have tests)

### 1. Money
- `formatPrice` renders piasters → "EGP 3,200" (and handles 0, odd piasters).
- Order totals: subtotal = Σ(snapshot unitAmount × qty); shipping from config; total = subtotal + shipping. Property-based test with random carts.
- **Tamper test**: POST checkout with a client-supplied total of 1 piaster → server ignores it, order total equals server computation.
- Price change mid-session: price updated in DB after add-to-cart → order uses price at order creation and snapshots it; later price changes never alter existing orders.

### 2. Stock (the oversell tests)
- Atomicity: order creation with an out-of-stock item in the cart fails wholesale — no partial decrement.
- **Concurrency**: stock=1; fire 2 (and 10) simultaneous order creations for that variant via `Promise.all` against the running server. Exactly one succeeds; stock ends at 0; others get a clean "out of stock" error, not a 500.
- Reservation release: create PENDING_PAYMENT order, advance/mock time past `RESERVATION_TTL_MINUTES`, run sweep → stock restored, order CANCELLED. Sweep is itself idempotent.
- COD decrements immediately; cancelled COD restocks.

### 3. Idempotency
- Same idempotency key POSTed twice to order creation → one order, second response returns it (200, same order number).
- Same Paymob webhook delivered 3× → one `PaymentEvent`, one PAID transition, one confirmation email.

### 4. Payment state machine
- Table-driven test of every (fromStatus, event) pair: legal transitions succeed, illegal ones (PAID→PENDING_PAYMENT, DELIVERED→PAID, webhook success on CANCELLED order) throw and change nothing.
- Client redirect to /checkout/success NEVER sets status — assert order stays PENDING_PAYMENT until webhook.

### 5. Webhook security
- Valid HMAC (test vector built from Paymob's documented field order + test secret) → accepted.
  - **Algorithm: HMAC-SHA512** (Paymob contract — NOT sha256). The mock provider uses sha256 for dev/test only.
  - **HMAC arrives as a `?hmac=` query parameter**, not a header.
  - Transaction callbacks nest the payload under `obj`; `order` unwraps to its `id`, `source_data.*` is flattened. Canonical field order is pinned in `tests/unit/paymob-hmac.test.ts`.
- Invalid signature → 401, no PaymentEvent row.
- Valid signature, amount ≠ order total → rejected + flagged (alert log), order NOT paid.
- Valid signature, unknown order ref → 200 (ack) + logged, nothing mutated.
- Comparison is timing-safe (assert `timingSafeEqual` used — unit test the verifier directly).
- Algorithm-mismatch rejection: a sha256 signature must NOT verify under sha512.

## e2e journeys (Playwright, mock provider)

1. **Browse & buy, card**: home → Aethra → signature pants PDP → pick colorway/size → add → drawer → checkout → contact/delivery → "Pay by card" → mock pay page → succeed → confirming page → order confirmed; assert order PAID in DB and stock decremented.
2. **Buy, COD**: same through delivery → COD → confirmation shows "prepare EGP {total}"; order PENDING_COD.
3. **Payment failure**: choose fail on mock page → returned to checkout with message; stock restored after TTL sweep (trigger sweep endpoint in test).
4. **OOS guardrails**: OOS size disabled on PDP; qty stepper capped at stock; direct API add beyond stock → 400.
5. **Cart persistence**: add item, new context with same cookie → cart intact.
6. **Admin**: login (wrong password → error + rate limit after 5), edit stock, mark COD order paid → status + email side-effect.
7. **Mobile viewport** (iPhone 14 size): journey 1 end-to-end; sticky buy panel and collapsed summary behave per design-system.md.
8. **a11y smoke**: axe-core on home, PDP, checkout — zero critical violations; keyboard-only checkout completion.

## What NOT to over-test
Visual styling minutiae (tokens tested once via config snapshot), Next.js internals, Prisma itself. One happy-path snapshot per email template is enough.

## Manual pre-launch checklist (with real Paymob sandbox)
- [ ] Real card test purchase (Paymob test cards) reaches PAID via webhook on the deployed URL.
- [ ] Apple Pay button appears on Safari/iPhone, Google Pay on Chrome/Android (sandbox).
- [ ] Webhook URL registered in Paymob dashboard = deployed endpoint; HMAC secret matches env.
- [ ] Refund from admin reflects in Paymob sandbox.
- [ ] COD order → mark paid → mark shipped emails arrive (real provider).
- [ ] 3G throttle: PDP LCP < 3s.
- [ ] Load: 50 concurrent mock checkouts — zero oversell, p95 order creation < 800ms.
