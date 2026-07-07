# WORKLOG — aïoly storefront

A running log of what shipped each phase, decisions made, and known gaps.
The roadmap lives in `implementation-roadmap.md`; this file records the *how*.

---

## Phase 0 — Foundation ✅

**Shipped**
- Next.js 15.5.20 (App Router, TS strict, RSC) + React 19. Patched past CVE-2025-66478 (original `15.5.4` flagged by npm as vulnerable; upgraded to latest 15.x patch).
- Tailwind CSS 4 with the full design-system.md token set wired into `@theme` in `src/app/globals.css`. Palette (ivory/ink/gold/etc.), both brand fonts (Cormorant Garamond display, Inter body), motion easing, radius, spacing scale. No arbitrary hex in components — only tokens.
- `next/font` self-hosting of both typefaces (no external `<link>`, no layout shift).
- CSS logical properties (`margin-inline`, `padding-block`) used throughout — RTL-ready. `prefers-reduced-motion` honoured globally.
- Core primitives: `Button` (primary/gold/ghost), `Wordmark`, inline hairline `Icon` set (no icon-library dep).
- `Header` (transparent over hero → solid ivory on scroll; mobile sheet nav) and `Footer` (three columns, newsletter, payment marks) per design-system.md §3.
- Home route shell: hero ("one perfect piece"), two collection blocks (Aether/Aethra), featured signature piece. Real product grids land in Phase 1.
- i18n messages file (`src/i18n/messages.ts`) — all UI copy centralised, tone-matched, no emoji, no "Buy now!!".
- **Money module** (`src/lib/money.ts`): `Piasters` type alias, `formatPrice`, `assertPiasters`, `sumPiasters`, `multiplyPrice`. Integer-only contract enforced; throws on floats/negatives/NaN. No floats near money.
- **Validated env** (`src/lib/env.ts`): Zod schema for every var, fails closed at boot, provider invariants (paymob requires its keys; resend requires API key). Production-readiness *policy* checks split into `productionPreflight()` run via `npm run preflight` — intentionally NOT at module load, because `next build` runs server code with `NODE_ENV=production` and a local gate-check build must pass. See **Decisions** below.
- **Prisma schema** (`prisma/schema.prisma`): all entities from CLAUDE.md — Product, Variant (with `reserved` for stock holds), Price (per variant+currency), Image, Cart/CartItem, Order (with `idempotencyKey`, `confirmToken`, snapshots), OrderItem (price/name snapshot), PaymentEvent (`eventKey` UNIQUE for webhook idempotency). Enums: Collection, Size, OrderStatus, PaymentMethod. Initial migration applied.
- **Seed** (`prisma/seed.ts`): the 5 launch styles with exact seed data from CLAUDE.md — integer-piastre prices (pants 320k, trouser 290k, blazer 550k, shirt 220k, dress 380k), 2 colorways each (Ivory/Ink except blazer Ink/Sand), sizes XS–XL, stock 6/variant. 5 products / 50 variants / 50 prices / 20 images. Idempotent (upserts).
- 20 placeholder product SVGs (4:5, brand palette) via `scripts/generate-placeholders.ts`.
- Helper scripts: `scripts/hash-password.ts` (bcrypt cost 12), `scripts/preflight.ts`.

**Tests (48 passing)**
- `money.test.ts` (20) — formatPrice happy/edge cases, zero, odd piasters, large amounts, rejects negative/float/NaN; isPiasters/assertPiasters boundaries; sum + multiply; launch-price property check against CLAUDE.md seed.
- `env.test.ts` (20) — happy path + defaults; coercion; COD country parsing; fail-closed rejections (missing DB URL, bad email, short secret, unknown provider, negative fees); provider invariants; production preflight.
- `tokens.snapshot.test.ts` (8) — palette hex values locked, no pure #fff/#000 tokens, gold-single-accent documented, fonts wired, radius, reduced-motion, logical properties, 2px focus outline.

**Gate checks — all green**
- `npm run typecheck` ✅ (TS strict, noUncheckedIndexedAccess)
- `npm run lint` ✅
- `npm test` ✅ 48/48
- `npm run build` ✅ (home + not-found prerendered)
- Dev server verified: `GET /` → 200, brand copy present in HTML.

**Decisions**
1. **Upgraded `next` 15.5.4 → 15.5.20.** npm flagged CVE-2025-66478 on 15.5.4. Project non-negotiable: no known-vulnerable deps. Used the latest 15.x patch (staying on 15 per the stack spec, not jumping to 16).
2. **Split env checks: correctness-at-load vs. policy-at-preflight.** The original invariant "no `EMAIL_PROVIDER=console` in production" fired during `next build` (which sets `NODE_ENV=production` for page-data collection), failing the gate check with a dev `.env`. Moved production *policy* checks into `productionPreflight()` run by `npm run preflight` (deploy gate). Module-load invariants now only cover *correctness* (missing keys that crash at runtime). This keeps the gate honest without weakening real-deploy safety.
3. **No icon library.** design-system.md says "hairline icons"; built an inline SVG set rather than adding `lucide-react` (would have needed approval + extra KB).
4. **`Wordmark` always links home** when rendered in the header/footer chrome; a `linked={false}` prop exists for bare-text contexts (footer copyright).
5. **Prisma `prisma` package.json key removed** (deprecated in Prisma 7) in favour of `prisma.config.ts`. Seed invoked via the `seed` npm script which loads `.env`; `npx prisma db seed` skips env loading under the new config — documented in CLAUDE.md command notes.

**Known gaps (intentional, deferred per roadmap)**
- ~~Home hero uses a tonal placeholder, not real photography~~ (lookbook TBD — placeholder tonal hero retained).
- Arabic/RTL activation deferred (layout is RTL-ready; messages file is English-only).
- `prisma.config.ts` triggers a benign "skipping environment variable loading" note under `prisma db seed` — non-blocking; `npm run seed` is the canonical path.

---

## Phase 1 — Catalog ✅

**Shipped**
- **Data-access layer** (`src/lib/catalog.ts`): `listProducts` + `getProductBySlug` returning typed view-models (`ProductCardVM`, `ProductDetailVM`) — components never touch raw Prisma rows. Prices flow out as integer piasters; colorway swatch hex from the brand palette; min-price-per-product derivation.
- **Availability module** (`src/lib/availability.ts`): `availableStock` (stock − reserved, never negative), `isInStock`, `maxAddableQty` (caps at `MAX_QTY_PER_LINE`), `resolveVariant` (colorway+size → variant, case-insensitive, pure), `sizesByColorway`. This is the safety-critical stock-math brain shared by display + (future) cart.
- **ProductCard** (`src/components/product/ProductCard.tsx`): 4:5 portrait, CSS crossfade hover-swap to second shot, colorway dots (ink gets an inset ring for visibility on ivory), name + tabular-nums price, sold-out meta. Server component.
- **Home** rebuilt with real data: hero (placeholder tonal field), collection blocks, featured signature piece (linked, with price), and a full catalog grid pulling all 5 products from the DB.
- **Collection pages** `/aether` + `/aethra`: filtered grids with per-page metadata, canonical URLs, collection-blurb headers.
- **PDP** (`/aether/[slug]`, `/aethra/[slug]`): 60/40 gallery + sticky buy panel per design-system.md §4. `Gallery` (full-bleed stacked images + drape-video slot), `ColorwaySelector` (gold-ring selected state), `SizeSelector` (44px cells, OOS = strikethrough + disabled + aria-label), `BuyPanel` (client; holds selection state, derives resolved variant + price + availability, colorway switch clears size). Fabric/care/description rendered. Add-to-cart CTA validates selection (server action lands Phase 2).
- **SEO**: per-page `metadata` (title/description/OG/Twitter), `sitemap.ts` (home + collections + all products with lastModified), `robots.ts` (admin/api/cart disallowed), **JSON-LD Product** schema with AggregateOffer on every PDP.

**Tests (now 62 unit + 7 e2e, all green)**
- `availability.test.ts` (14) — stock math, OOS, qty caps, variant resolution, sizes-by-colorway.
- e2e `browse.spec.ts` (7) — home grid, both collections, home→collection→PDP journey with size selection + colorway switch, OOS-disabled guardrail, sitemap completeness, JSON-LD Product emission.

**Gate checks — all green**
- typecheck ✅ · lint ✅ · `npm test` ✅ (62) · `npm run build` ✅ (8 routes) · `npm run test:e2e` ✅ (7)

**Decisions**
1. **`dangerouslyAllowSVG: true`** in `next.config.ts` — our placeholder product imagery is SVG (own brand assets, generated locally). Paired with a strict `contentSecurityPolicy` (`script-src 'none'; sandbox;`) so served SVGs can't execute. Removable once real raster photography ships with the lookbook.
2. **Stock math isolated in `availability.ts`.** Keeps the "never read raw stock for a sell decision" invariant in one auditable place; both catalog display and the Phase 2 cart go through it.
3. **PDP buy panel is client, data is server.** The page is a server component fetching the VM; `BuyPanel` receives serialized data and holds only selection state. Keeps the page fast (RSC) while the interaction stays local.
4. **Collection in URL is cosmetic for routing, canonical for links.** Both `/aether/[slug]` and `/aethra/[slug]` resolve by slug; canonical URLs always match the real collection so there's no duplicate-content SEO issue.

**Known gaps**
- Add-to-cart is a no-op log in Phase 1 (server action + cart drawer land in Phase 2).
- No drape video asset yet (Gallery slot is wired; render is conditional on `videoSrc`).
- Lighthouse full run deferred to Phase 6 hardening (placeholder SVGs are lightweight; expect targets to hold).

---

## Phase 2 — Cart ✅ (and: real logo + credential rotation scheduled)

**Brand/logo**
- Real aïoly logo asset (`public/brand/logo.jpeg`) integrated via a new `Logo` component. Replaced the text wordmark in the Header (centered) and Footer. Source carries icon + wordmark + "MAISON DE MODE EST 2024" tagline on an ivory field.
- **Roadmap:** credential rotation (Supabase DB password shared in chat during setup, temporary admin password `aioly-admin-2026`, `SESSION_SECRET`) is now a mandatory Phase 6 deliverable.

**Cart — server-persisted (the build-prompt contract)**
- `lib/cart/cookies.ts` — unguessable 256-bit cookie token; httpOnly, sameSite=lax, Secure in prod, 90-day expiry. Cookie writes are correctly scoped: only Server Actions / Route Handlers may set cookies (RSCs read-only). This distinction fixed a 500 on `/cart` (Server Components can't call `cookies().set()`).
- `lib/cart/repository.ts` — the only module reading/writing cart rows. `ensureCartToken` (mutating, actions/handlers) vs `readCartTokenForRSC`/`loadCartForRSC` (read-only, Server Components). **Totals recomputed server-side from DB prices** on every load — subtotal, shipping (waived at threshold), total. Free-shipping progress derived.
- `lib/cart/actions.ts` — `addToCart` / `updateQty` / `removeFromCart` server actions, all Zod-validated. **Stock caps enforced server-side on every write** (can't exceed `available = stock − reserved`); overflow returns a clean message, never a 500.
- `/api/cart` Route Handler — single read path for the client; creates the guest cart lazily.
- `/cart` — full-page server-rendered fallback (works without JS).

**Cart UI**
- `CartProvider` — client context that mirrors the server source of truth: after every mutation it re-fetches from `/api/cart` so totals are always server-computed (no client-side price math).
- `CartDrawer` — right-side 420px panel per design-system.md §5: hairline rows, pill quantity stepper, free-shipping progress line (ink-soft), gold checkout CTA. Focus-friendly (Escape to close, scroll-lock).
- PDP `BuyPanel` wired to `add()` — selects colorway+size, resolves the variant, calls the action, opens the drawer, shows errors inline.
- Header cart button opens the drawer and shows the count badge in gold.

**Tests (now 67 unit/integration + 14 e2e, all green)**
- `tests/integration/cart.test.ts` (5) — runs against **live Supabase**: stock-cap on add, allow-exactly-available, reject-over-cap on update, qty-0 removal, server-computed line/subtotal math.
- e2e `cart.spec.ts` (7) — add→drawer, qty stepper, remove, free-shipping unlock, persistence across navigation, `/cart` page populated + empty state.

**Gate checks — all green**
- typecheck ✅ · lint ✅ · `npm test` ✅ (67) · `npm run build` ✅ (10 routes) · `npm run test:e2e` ✅ (14)

**Decisions**
1. **Cookie-write scope split.** `cookies().set()` throws in Server Components. Separated `ensureCartToken` (mutating, for actions/handlers) from `readCartTokenForRSC` (read-only). The `/cart` Server Component uses the read-only path; an empty cart renders without ever creating a row.
2. **Action tokens injectable for tests.** `addToCart`/`updateQty`/`removeFromCart` accept an optional `{ token }` so integration tests bypass the cookie layer (no request context needed) and run directly against Supabase.
3. **No client price math.** The drawer/provider never computes totals — it always re-fetches from the server after a mutation. Keeps the "server is source of truth" invariant honest.
4. **`tests/setup.ts` loads `.env`** so integration tests reach Supabase while unit tests stay pure (they never touch the DB).

**Known gaps**
- ~~Checkout button currently routes to `/cart`~~ — Phase 3 builds `/checkout`.
- The logo is now the transparent vector mark (floats over the hero).
- Online payment (card/Apple Pay/Google Pay) lands in Phase 4.

---

## Phase 3 — Checkout & COD ✅ (first sellable milestone)

**The safety-critical core**
- **Order state machine** (`lib/orders/state-machine.ts`): adjacency-map of legal transitions; illegal ones throw `IllegalTransitionError` and mutate nothing. Only `online_payment_succeeded` moves PENDING_PAYMENT→PAID (Phase 4 webhook); COD starts at PENDING_COD. Table-driven over every (status, event) pair.
- **`createOrder` transaction** (`lib/orders/create-order.ts`): all four checkout invariants enforced in one Prisma interactive transaction:
  1. Totals recomputed SERVER-SIDE from DB prices; the request schema has no `total` field, so a tampered total is structurally impossible to honor.
  2. **Atomic stock decrement** via a conditional `$executeRaw` (`UPDATE ... WHERE stock - reserved >= qty`); zero rows affected ⇒ someone took the unit ⇒ whole order aborts, nothing decremented. This is the oversell guard — it beats Prisma's Read Committed default, which lost the race under contention.
  3. Idempotency: same `idempotencyKey` → returns the existing order (no duplicate on retry).
  4. Price/name snapshots frozen on `OrderItem`; a later price change never alters past orders.
- **Zod schemas** (`lib/orders/schemas.ts`): Egyptian phone regex, governorate enum, length caps + character allow-lists on every free-text field (these get printed on shipping labels / injected into courier APIs later).
- **Order identifiers**: `identifiers.ts` (client-safe: `generateIdempotencyKey` via Web Crypto) split from `identifiers.server.ts` (node:crypto `generateConfirmToken`) so the checkout form doesn't pull node:crypto into the browser bundle.

**UI**
- **Checkout** (`/checkout`): single page, three steps (contact → delivery → payment), server-loaded cart summary, COD radio with the "prepare EGP {total}" note, trust row (secure payment / easy returns / Cairo atelier). Gold "Place order" CTA.
- **Confirmation** (`/orders/[token]`): token-gated (unguessable 256-bit token, NOT the order number), noindex, COD note + items + status line.
- **Email** (`lib/email.ts`): provider abstraction (console in dev, Resend in prod), plain-text renderer + snapshot. Fired non-blocking after the order commits.

**Tests (now 136 unit + 11 integration + 17 e2e — all green)**
- `state-machine.test.ts` (69): every legal + illegal pair + headline invariants.
- `tests/integration/checkout.test.ts` (4): COD happy path, idempotency, atomicity (no partial decrement), price snapshot survival.
- `tests/integration/checkout.concurrency.test.ts` (2): **the oversell headline** — stock=1, 2 and 10 simultaneous checkouts, exactly ONE wins, rest get clean `OutOfStockError`, stock ends at 0.
- e2e `checkout.spec.ts` (3): full COD purchase → confirmation page, empty-cart state, **tampered-total ignored** (POST with `total: 1` → order total = 226000, the server computation).

**Gate checks — all green**
- typecheck ✅ · lint ✅ · `npm test` ✅ (147) · `npm run build` ✅ (12 routes) · `npm run test:e2e` ✅ (17)

**Decisions**
1. **Conditional `$executeRaw` for the decrement** instead of Prisma's `decrement` helper. Prisma's Read-Committed default lost the last-unit race (two txns both read stock=1, both decrement). The atomic conditional update is the only correct tool; it's fully parameterized (no interpolation), so the security-review flag for raw SQL doesn't apply.
2. **Order number from max-suffix, not count.** `count()+1` collides after deletions (test cleanup) — re-issued numbers hit the UNIQUE constraint. Now reads the highest existing `AIY-NNNNNN` suffix + 1, with a P2002-retry loop as a belt-and-braces for true concurrency.
3. **Single-threaded vitest for integration.** Prisma interactive transactions contend on Supabase's PgBouncer pool; parallel test files deadlocked. Set `pool.threads.singleThread`. Documented as the tradeoff of the free-tier pooler.
4. **`identifiers.ts` / `identifiers.server.ts` split.** The client checkout form mints its own idempotency key (Web Crypto); the server-only confirm token stays in a node:crypto module. Keeps `node:` out of the browser bundle.

**Known gaps**
- Online payment path (Phase 4) not built — checkout is COD-only for now.
- Reservation TTL sweep (release stock of abandoned online payments) lands in Phase 4.
- Admin order management (mark COD paid) lands in Phase 5.

---

## Phase 4 — Online payments (Paymob) ✅

**The PaymentProvider seam**
- `lib/payments/provider.ts` — the interface (`createIntent`, `verifyWebhook`, `refund`). Checkout code talks ONLY to this; a second Gulf provider (Phase 7) slots in without touching checkout. Card data never touches our servers (hosted checkout / redirect only) → out of PCI SAQ-D scope.
- `lib/payments/mock-provider.ts` — the dev/test provider: `createIntent` returns a local `/mock-pay/[ref]` page; its webhook uses the **same HMAC verify path** as the real provider, so the security-critical signature logic is exercised end-to-end in tests.
- `lib/payments/paymob-provider.ts` — the production provider (Paymob Intention API: card + Apple Pay + Google Pay). HMAC over Paymob's documented field order, timing-safe compared. Slotted behind the factory; not active until `PAYMENT_PROVIDER=paymob` + keys.

**The webhook — the ONLY thing that moves an order to PAID**
- `app/api/webhooks/[provider]/route.ts`: verify signature (throws → 401, no `PaymentEvent`) → resolve order → **dedupe on `PaymentEvent.eventKey`** (replay is a no-op) → **compare paid amount vs order total** (mismatch → flagged, NOT paid) → transition PENDING_PAYMENT→PAID. Unknown order refs are acked (200) but mutate nothing.
- `lib/payments/hmac.ts` — `computeHmac` / `safeEqualHex` (`crypto.timingSafeEqual`); never `===` on signatures. The verifier is a pure, unit-tested function.
- `lib/payments/mask.ts` — strips anything beyond what fulfilment needs before persisting `rawPayload` (privacy §F).

**The online-payment flow**
- Checkout offers two equal-weight options: "Pay by card / Apple Pay / Google Pay" and "Cash on delivery". CARD/WALLET creates a `PENDING_PAYMENT` order + payment intent → redirects to the provider's hosted checkout (mock page in dev, Paymob in prod).
- `/checkout/confirming/[token]` — **"Confirming your payment…"** polling page. It NEVER sets status (the invariant); it only reads order status every 1.5s and reflects the webhook outcome — success redirects to the confirmation page, failure shows a gentle message.
- `/mock-pay/[ref]` — succeed/fail buttons that POST a correctly-signed webhook via `/api/mock-pay/sign` (secret stays server-side).
- `lib/orders/sweep.ts` + `/api/cron/sweep` — reservation TTL sweep: abandoned `PENDING_PAYMENT` orders older than the TTL are restocked + cancelled. Idempotent.

**Tests (now 149 unit + 16 integration + 19 e2e — all green)**
- `hmac.test.ts` (13): valid/invalid signature, timing-safety, forged signature, replay handling.
- `webhook.test.ts` (5): signed success → PAID; replay dedupe; **amount-mismatch rejected**; bad signature → 401 + no audit row; unknown order acked.
- e2e `payment.spec.ts` (2): full card success path (→ PAID via webhook) + failure path (→ cancelled).

**Gate checks — all green**
- typecheck ✅ · lint ✅ · `test:unit` ✅ (149) · `test:integration` ✅ (16) · `npm run build` ✅ (16 routes) · `npm run test:e2e` ✅ (19)

**Decisions**
1. **Built against the MockPaymentProvider**, per CLAUDE.md — the entire card flow is testable end-to-end now; the real Paymob provider is implemented and slotted behind the factory, activating when keys are set. No Paymob sandbox keys were available.
2. **Mock signs with the same HMAC path as Paymob.** The mock pay page calls `/api/mock-pay/sign` (server-side) so the secret never reaches the browser, and the webhook handler exercises the identical verify+dedupe+amount-check+transition code the production provider will use.
3. **Connection-pool retry in `createOrder`.** Supabase's free-tier transaction pooler (PgBouncer) intermittently rejects concurrent interactive transactions (P1000/P2034). Added a one-shot retry on those transient codes — correct production behavior (recoverable contention), and it made the 10-way concurrency test reliable. Documented the upgrade path (dedicated pooler / higher plan) for real launch load.
4. **Integration tests run serial** (`--no-file-parallelism`) — PgBouncer can't sustain multiple interactive-transaction files in parallel. `npm run test:integration` is the canonical command; `npm test` runs unit only (fast, no DB contention).

**Known gaps**
- Paymob provider untested against a live sandbox (no keys). The manual pre-launch checklist (TESTING_GUIDE.md) covers real-card + wallet-button verification once keys exist.
- Wallet buttons (Apple Pay/Google Pay) render inside Paymob's hosted checkout, not our selector — device-detection is Paymob's job.

---

## Next: Phase 5 — Admin & operations

## Phase 5 — Admin & operations ✅

**Auth (the security gate)**
- `lib/admin/auth.ts` — bcrypt verify (cost ≥ 12), signed JWT session via `jose` (HS256 over SESSION_SECRET), in-memory login rate limiter (5 attempts / 15 min, per-IP, cleared on success).
- `middleware.ts` — the single gate: matcher `/admin/:path*` + `/api/admin/:path*`; unauthenticated → redirect to login (pages) or 401 (API). Re-verifies the JWT signature + expiry on every request. `/admin/login` + `/api/admin/login` are the only public admin paths.
- Login page (`/admin/login`) + `POST /api/admin/login` — Zod-validated, no user enumeration (identical error for wrong email vs wrong password), sets httpOnly/Secure/SameSite cookie.

**Operations**
- Dashboard — product/variant/order counts + low-stock indicator (≤3 units).
- Products — editable table: per-variant stock + price (EGP), publish/hidden toggle, low/out flags. All via server actions (`updateStock`, `updatePrice`, `togglePublish`).
- Orders — list (newest first) + detail with shipping address, items, payment-event audit trail, and status transitions through the state machine (`markOrderPaid` PENDING_COD→PAID, `startFulfilling` PAID→FULFILLING, `markOrderShipped` FULFILLING→SHIPPED + tracking + email). Illegal transitions rejected.
- CSV export (`/api/admin/orders/export`) — number, status, payment, email, total (EGP), items, created.

**Tests (now 149 unit + 16 integration + 29 e2e — all green)**
- e2e `admin.spec.ts` (10): authz on every admin route (3 pages redirect, API 401), login (wrong password, rate-limit after 5, correct credentials → dashboard), edit stock, list orders, CSV export authenticated.

**Gate checks — all green**
- typecheck ✅ · lint ✅ · `test:unit` ✅ (149) · `test:integration` ✅ (16) · `npm run build` ✅ (22 routes) · `npm run test:e2e` ✅ (29)

**Decisions**
1. **dotenv `$` escaping for bcrypt hashes.** Bcrypt hashes contain `$` (e.g. `$2b$12$...`), and dotenv expands `$2b`/`$12`/`$salt` as empty variables, silently corrupting the hash → every login failed. Fixed by escaping each `$` as `\$` in local `.env` (and documented that Vercel/Supabase dashboards take the raw value). `scripts/hash-password.ts` now prints both forms.
2. **Full-page navigation after login.** Client-side `router.replace("/admin")` raced the cookie-set; the first `/admin` fetch sometimes didn't carry the new session cookie → bounced back to login. Switched to `window.location.href` so the cookie is guaranteed sent. Documented.
3. **Image upload deferred to Phase 6.** It needs storage config (Vercel Blob / S3) which is a deployment concern; admin can edit the seeded images' URLs for now. The content-type + magic-byte validation described in the security audit lands with the storage integration.
4. **Rate limiter is in-memory** (persists within one server process). Tests order the rate-limit test last so its exhausted bucket doesn't block other logins. Phase 6 records the multi-instance upgrade path (Upstash/edge KV).

**Known gaps**
- Image upload not built (Phase 6 — needs storage).
- Rate limiting is single-instance (Phase 6 upgrade to shared store).

---

## Next: Phase 6 — Polish & launch hardening

Transactional email on Resend; analytics events (GA4/Meta-ready); error pages; rate limiting on checkout/webhook (shared store); security headers (CSP, HSTS, frame-deny); image optimization + upload; RUNBOOK.md; **credential rotation** (Supabase password, admin password, session secret — all shared during setup); security audit (claude-code-security-testing-prompt.md) + fix HIGHs; load test. Awaiting go-ahead.
