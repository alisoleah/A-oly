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
- Home hero uses a tonal placeholder, not real photography (lookbook TBD).
- Product grid / PDP not built (Phase 1).
- Cart, checkout, payments, admin not built (Phases 2–5).
- No e2e yet (Phase 1 introduces Playwright; `playwright.config.ts` is staged).
- Arabic/RTL activation deferred (layout is RTL-ready; messages file is English-only).
- `prisma.config.ts` triggers a benign "skipping environment variable loading" note under `prisma db seed` — non-blocking; `npm run seed` is the canonical path.

---

## Next: Phase 1 — Catalog

Home product grid, collection pages (`/aether`, `/aethra`), PDP with gallery + sticky buy panel + variant selection, SEO metadata + JSON-LD Product, sitemap. Lighthouse ≥90 perf / ≥95 a11y targets. Awaiting go-ahead.
