# CLAUDE.md — aïoly storefront

Project instructions for Claude Code. Read design-system.md and implementation-roadmap.md alongside this file.

## What this project is

Custom e-commerce storefront for aïoly, a premium women's fashion label (Egypt first, Gulf later). Brand promise: "one perfect piece." The site must FEEL premium: restrained, fast, typographic, generous whitespace. When in doubt, remove elements.

## Stack (do not deviate without asking)

- Next.js 15, App Router, TypeScript strict, React Server Components by default; `"use client"` only where interaction demands it.
- Tailwind CSS 4 — tokens from design-system.md only. No arbitrary hex values in components.
- Prisma ORM. Dev: SQLite. Prod: PostgreSQL (Neon/Supabase). Migrations checked in.
- Zod for ALL external input (API routes, server actions, webhooks, env vars via a validated `env.ts`).
- Auth: admin-only for now — signed session cookie, credentials from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, bcrypt).
- Email: provider abstraction (`lib/email.ts`); Resend in prod, console transport in dev.
- Tests: Vitest (unit/integration), Playwright (e2e). Testing details in TESTING_GUIDE.md.
- Approved deps: next, react, prisma/@prisma/client, zod, tailwindcss, bcryptjs, resend, vitest, @playwright/test, iron-session (or jose for cookie signing). Anything else: ask first.

## Commands

- `npm run dev` — dev server
- `npm run build && npm start` — prod build check (must pass before any phase is "done")
- `npx prisma migrate dev` / `npx prisma studio`
- `npm run seed` — seed the 5 launch styles (see Seed data)
- `npm test` — Vitest; `npm run test:e2e` — Playwright
- `npm run lint` / `npm run typecheck` — both must be clean before finishing a phase

## Architecture rules

### Money
- All amounts are **integer piasters** (EGP × 100). Type alias `Piasters = number` with helper `formatPrice()`. No floats, no `parseFloat` on money, ever.
- `Price` table keyed by (variantId, currency) — EGP only for launch; AED/SAR rows later.

### Data model (Prisma, core entities)
- `Product` (slug, name, collection AETHER|AETHRA, description, fabricNote, careNote, published)
- `Variant` (productId, colorway, size XS–XL, sku, stock, weightGrams)
- `Price` (variantId, currency, unitAmount)
- `Image` (productId, colorway, url, alt, sortOrder)
- `Cart` (id, cookie token, expiresAt) / `CartItem` (cartId, variantId, qty)
- `Order` (number, email, phone, shippingAddress JSON, status, paymentMethod CARD|WALLET|COD, subtotal, shipping, total, currency, idempotencyKey UNIQUE)
- `OrderItem` (orderId, variantId, nameSnapshot, unitAmountSnapshot, qty) — snapshot price/name at purchase.
- `PaymentEvent` (orderId, provider, providerRef, type, rawPayload JSON, processedAt, eventKey UNIQUE) — audit log; eventKey enforces webhook idempotency.

### Payments — the PaymentProvider seam
```ts
interface PaymentProvider {
  name: string;
  createIntent(order: OrderForPayment): Promise<{ redirectUrl?: string; clientSecret?: string; providerRef: string }>;
  verifyWebhook(req: Request): Promise<VerifiedEvent>; // throws on bad signature
  refund(providerRef: string, amount: Piasters): Promise<void>;
}
```
- `PaymobProvider` implements this using Paymob's Intention API (unified checkout: card + Apple Pay + Google Pay). HMAC verification per Paymob docs using `PAYMOB_HMAC_SECRET`; compute over the documented ordered fields, compare with `crypto.timingSafeEqual`.
- `MockPaymentProvider` for dev/tests: `createIntent` returns a local `/mock-pay/[ref]` page with "succeed"/"fail" buttons that POST a correctly-signed fake webhook to our own endpoint. e2e tests run entirely on the mock.
- Provider chosen by `PAYMENT_PROVIDER=paymob|mock` env.
- **Order state machine**: only the webhook handler transitions `PENDING_PAYMENT → PAID`. The success redirect page shows "confirming your payment…" and polls order status; it never sets it.
- **COD**: order created directly as `PENDING_COD` with stock decremented; admin marks PAID on collection. COD gated by `codEnabled` per shipping country.

### Checkout invariants (test these explicitly)
1. Totals recomputed server-side from DB prices at order creation; client-sent totals ignored.
2. Stock check + decrement inside the same DB transaction as order creation (`SELECT ... FOR UPDATE` semantics via Prisma interactive transaction). Concurrent purchases of the last unit: exactly one succeeds.
3. Idempotency: order-creation endpoint requires an idempotency key (issued to the checkout page); retries return the same order. Webhooks deduped on `PaymentEvent.eventKey`.
4. A failed/abandoned online payment releases reserved stock after `RESERVATION_TTL_MINUTES` (default 30) via a sweep job (cron route).

### Security baseline (see claude-code-security-testing-prompt.md for the audit)
- All mutations via server actions or API routes with Zod schemas; return 400 on any parse failure.
- Session cookies: httpOnly, secure, sameSite=lax, signed.
- Rate limit checkout + webhook + admin login (simple in-memory token bucket now; note upgrade path).
- CSP headers, no `dangerouslySetInnerHTML` with user data, admin routes behind middleware.
- Never log full card data or webhook secrets; card data never touches our servers (hosted fields / redirect only) — this keeps us out of PCI SAQ-D scope.

## Frontend rules

- Follow design-system.md exactly: tokens, type scale, spacing, imagery ratios, motion.
- Product imagery is the hero — 4:5 ratio cards, full-bleed PDP gallery, next/image with proper `sizes`.
- No component libraries (no shadcn/MUI); build the small set of primitives in design-system.md.
- Use CSS logical properties (`ms-`, `me-`, `ps-`…) so RTL/Arabic works later.
- Copy tone: warm, assured, understated. Never "Buy now!!", never emoji in UI copy.

## Seed data

5 products (from the business plan): Signature Asymmetric Draped Pants (Aethra, EGP 3,200), Wide-Leg Trouser (Aether, 2,900), Tailored Blazer (Aethra, 5,500), Fluid Shirt (Aether, 2,200), Column Dress (Aether, 3,800). Two colorways each (Ivory/Ink except blazer: Ink/Sand), sizes XS–XL, stock 6 per variant, placeholder images in brand palette.

## Definition of done (every phase)

- `npm run build`, `lint`, `typecheck`, `test`, `test:e2e` all green.
- New behavior covered by tests per TESTING_GUIDE.md.
- WORKLOG.md updated: what shipped, decisions, known gaps.
- No TODOs affecting money, stock, or auth left in code.
