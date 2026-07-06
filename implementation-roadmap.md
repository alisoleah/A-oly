# aïoly storefront — Implementation Roadmap

Seven phases. Each phase has acceptance criteria and required tests (TESTING_GUIDE.md). Do not begin a phase until the previous one is fully green. Estimated effort assumes Claude Code doing the work with the founder reviewing.

## Phase 0 — Foundation (scaffold, tokens, data)
**Build:** Next.js 15 + TS strict + Tailwind scaffold; design tokens from design-system.md wired into the Tailwind theme; validated `env.ts`; Prisma schema (all entities from CLAUDE.md); migrations; seed script for the 5 launch styles; base layout (header, footer, fonts); WORKLOG.md started.
**Accept:** `build/lint/typecheck` green; `prisma studio` shows seeded catalog; home route renders shell with correct tokens.
**Tests:** unit — price formatting (`formatPrice`), env validation rejects bad env; snapshot of token config.

## Phase 1 — Catalog
**Build:** Home (hero, collection blocks, featured piece), collection pages (/aether, /aethra) with ProductCard grid, PDP (gallery + sticky buy panel, colorway/size selection, fabric & care notes, drape-video slot), SEO (metadata, OG images, JSON-LD Product), sitemap.
**Accept:** All 5 products browsable both colorways; out-of-stock sizes disabled; Lighthouse ≥90 perf / ≥95 a11y on home + PDP.
**Tests:** e2e — browse home → collection → PDP, select variant, OOS size not selectable; unit — variant resolution logic.

## Phase 2 — Cart
**Build:** Server-persisted cart (cookie token), add/update/remove server actions, cart drawer per design system, stock-aware quantity caps, cart page fallback, free-shipping threshold line.
**Accept:** Cart survives refresh and browser restart; cannot add beyond stock; totals always server-computed.
**Tests:** integration — cart CRUD, stock cap; e2e — add two variants, change qty, remove, drawer totals correct; race — two tabs mutating one cart stay consistent.

## Phase 3 — Checkout & COD (first sellable milestone)
**Build:** Single-page checkout (contact → delivery → payment steps), Zod-validated Egyptian address + phone, shipping fee config, **COD path end-to-end**: order creation in transaction (atomic stock decrement, idempotency key, price snapshot), order confirmation page + email (console transport), admin-visible order record.
**Accept:** Full COD purchase works; last-unit concurrency test passes (exactly one of two simultaneous checkouts succeeds); replayed submit returns same order.
**Tests:** integration — transaction atomicity, idempotent creation, server-side total recomputation ignores tampered client totals; e2e — complete COD purchase; email content snapshot.

## Phase 4 — Online payments (Paymob: card, Apple Pay, Google Pay)
**Build:** `PaymentProvider` interface + `MockPaymentProvider` + `PaymobProvider` (Intention API); payment method selector UI; redirect/hosted checkout flow; webhook endpoint with HMAC verification (timing-safe), `PaymentEvent` dedupe, state transition PENDING_PAYMENT→PAID only via webhook; "confirming payment" polling page; reservation TTL sweep releasing stock of abandoned payments; refund hook (admin-triggered).
**Accept:** Full purchase on MockProvider in CI; with sandbox keys, real Paymob card test succeeds and wallet buttons appear on supporting devices; forged/replayed webhooks rejected/deduped; abandoned payment restocks after TTL.
**Tests:** unit — HMAC verify (valid/invalid/replay); integration — webhook idempotency, state machine rejects illegal transitions (e.g., PAID→PENDING); e2e on mock — success path, failure path (stock released), tampered-amount webhook rejected.

## Phase 5 — Admin & operations
**Build:** /admin behind auth middleware (env credential, bcrypt, signed session, login rate-limit); product & variant CRUD with image upload (Vercel Blob or S3-compatible); stock adjustments with audit note; order list + detail + status transitions (mark COD paid, mark shipped w/ tracking → email); CSV export; low-stock indicator.
**Accept:** Founder can run the store without touching the DB; all admin mutations audited; unauthenticated /admin fully blocked.
**Tests:** integration — authz on every admin route (401 unauthenticated), status transition rules; e2e — login, edit stock, progress an order.

## Phase 6 — Polish & launch hardening
**Build:** Transactional email on real provider (Resend); analytics events (view_item, add_to_cart, begin_checkout, purchase) via a thin wrapper (GA4/Meta pixel-ready); error pages; rate limiting on checkout/webhook/login; security headers (CSP, HSTS, frame-deny); image optimization audit; RUNBOOK.md (deploy, env rotation, refund procedure, webhook replay); run claude-code-security-testing-prompt.md audit and fix all HIGH findings.
**Accept:** Lighthouse targets hold on prod build; security audit HIGHs = 0; load test — 50 concurrent checkouts, zero oversell, p95 < 800ms on order creation.
**Tests:** full regression suite green; header assertions; load script in repo.

## Later (explicitly out of scope now)
Customer accounts & order history, reviews/UGC, gift cards, search.

## Phase 7 — Gulf expansion (AED/SAR currency + second payment provider)
**Prerequisite:** Supabase Postgres live (see `docs/DEPLOYMENT.md`); schema already has `Price.currency` + per-currency rows.
**Build:** add AED/SAR price rows (still integer minor units); currency switcher resolved by shipping country; a second `PaymentProvider` implementation for the Gulf (e.g. a local gateway) slotted behind the existing `PaymentProvider` seam — **no checkout code changes**; COD availability extended via `COD_ENABLED_COUNTRIES`; shipping rules per region.
**Accept:** A Gulf customer sees AED prices, pays through the Gulf provider, and the order stores the correct currency. Egyptian flow unchanged.
**Tests:** price resolution by country; provider selection by env; checkout invariant suite re-run for both currencies.

## Phase 8 — Arabic / RTL activation
**Prerequisite:** all components already use CSS logical properties (Phase 0) and copy is in `messages.ts` (not hardcoded) — this phase is activation, not a rewrite.
**Build:** Arabic translation of `messages.ts` (`messages.ar.ts`); locale switcher; `dir="rtl"` on `<html>` per locale; verify the layout (margins, drawer side, icon positions) reads correctly RTL; PDP/product copy translated; Arabic email templates (RTL). Arabic font pairing (e.g. IBM Plex Sans Arabic / Noto Naskh Arabic) added alongside Inter/Cormorant.
**Accept:** Arabic site is fully RTL, contrast passes, checkout completes end-to-end in Arabic; no visual regressions in the English (LTR) site.
**Tests:** snapshot key screens in both `dir` values; e2e a COD purchase in Arabic.
