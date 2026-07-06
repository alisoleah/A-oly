# aïoly — Master Build Prompt for Claude Code

Paste this as your first message in Claude Code, in a repo containing CLAUDE.md, design-system.md, implementation-roadmap.md, and TESTING_GUIDE.md.

---

Build the aïoly e-commerce storefront — a premium women's fashion brand (minimalist, ivory/ink/gold, "one perfect piece"). Read CLAUDE.md, design-system.md, and implementation-roadmap.md fully before writing any code, then execute the roadmap phase by phase. Do not skip ahead: complete each phase's acceptance criteria and its tests (see TESTING_GUIDE.md) before starting the next.

## What we are building

A custom, high-end direct-to-consumer storefront:

- **Stack**: Next.js 15 (App Router, TypeScript, RSC), Tailwind CSS 4 using the tokens in design-system.md, Prisma + PostgreSQL (SQLite in dev), Zod validation everywhere, deployed on Vercel.
- **Catalog**: 5 launch styles, each with colorway variants, sizes (XS–XL), per-variant stock. Collections: Aether, Aethra.
- **Cart**: server-persisted cart (cookie-keyed for guests, merged on login later). No client-only cart state as source of truth.
- **Checkout** — the heart of the build. Two payment paths, equal citizens:
  1. **Online payment via Paymob**: card, Apple Pay, Google Pay. Implement behind a `PaymentProvider` interface (`createIntent`, `verifyWebhook`, `refund`) so a second provider (Gulf expansion) can be added without touching checkout code. Use Paymob's Intention API / unified checkout; render Apple Pay and Google Pay buttons only when the device supports them.
  2. **Cash on Delivery (COD)**: creates the order in `PENDING_COD` status, sends confirmation, no payment intent. COD availability is a per-country config flag (Egypt: on).
- **Orders**: statuses `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED`, plus `PENDING_COD`, `CANCELLED`, `REFUNDED`. Webhook from Paymob (HMAC-verified) is the ONLY thing that moves an order to PAID. Never trust the client redirect.
- **Currency & pricing**: prices stored in integer piasters (EGP minor units). Display EGP now; schema includes a `currency` column and per-currency price table for AED/SAR later.
- **Admin (minimal)**: auth-protected /admin for product CRUD, stock adjustment, order list with status transitions, and CSV export. No role system yet — single admin credential via env.
- **Transactional email**: order confirmation, shipping notification (Resend or SMTP abstraction).
- **i18n-ready**: copy in a messages file, RTL-safe layout (logical CSS properties), Arabic deferred but not blocked.

## Non-negotiables

1. Money is integers. No floats anywhere near a price.
2. Stock is decremented atomically inside the order-creation transaction; oversell must be impossible under concurrent checkouts.
3. Every API input validated with Zod; every webhook HMAC-verified; idempotency keys on order creation and webhook processing (a replayed webhook must not double-fulfil).
4. Server is the source of truth for cart totals — recompute price server-side at checkout; never accept a total from the client.
5. Lighthouse ≥ 90 performance / ≥ 95 accessibility on product and home pages.
6. Every phase ends with passing tests (Vitest unit + Playwright e2e per TESTING_GUIDE.md) and a short WORKLOG.md entry.

## How to work

- Start with Phase 0 of implementation-roadmap.md (scaffold, tokens, DB schema, seed data for the 5 launch styles).
- After each phase: run the full test suite, fix everything, show me a summary of what shipped and what's next, then wait for my go before the next phase.
- If Paymob credentials are not yet in .env, build against the `MockPaymentProvider` (defined in CLAUDE.md) so the whole flow is testable end-to-end; the real provider slots in later.
- Ask me before adding any dependency not listed in CLAUDE.md.

Begin with Phase 0 now.
