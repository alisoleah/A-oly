# aïoly storefront — Security Audit Prompt for Claude Code

Run this in Phase 6 (and before every major release) on the completed codebase. Paste as a single message.

---

Act as a senior application security engineer performing a defensive audit of THIS repository — our own e-commerce storefront — before launch. Your job is to find and fix vulnerabilities in our code, not to produce exploit tooling. Work read-first: build a threat model, then verify each area below against the actual code, then fix.

## Context
Next.js 15 App Router storefront. Money in integer piasters. Payments: Paymob (card/Apple Pay/Google Pay) behind a `PaymentProvider` interface + Cash on Delivery. Card data never touches our servers (hosted checkout/redirect). Admin is single-credential via env. The crown jewels, in order: (1) order/payment integrity, (2) customer PII (names, phones, addresses), (3) admin access, (4) availability during launch.

## Method
1. Map every trust boundary: browser→server actions, browser→API routes, Paymob→webhook, admin→/admin, server→Paymob API, server→email provider.
2. For each area below: locate the relevant code, state whether the control exists, and classify findings HIGH / MEDIUM / LOW with file:line references.
3. Fix all HIGH and MEDIUM findings directly (smallest safe diff), adding a regression test for each fix per TESTING_GUIDE.md conventions.
4. Produce SECURITY_AUDIT.md: threat model summary, findings table (id, severity, area, file, status), fixes applied, accepted risks with justification, and the re-run instructions.

## Audit areas

### A. Payment & order integrity (highest priority)
- Webhook HMAC: verified on every payment webhook, timing-safe comparison, secret only from env, no verification bypass in any code path (including "test" branches accidentally shipped).
- Webhook logic: amount and currency compared against the order before marking PAID; unknown order refs acked but never mutate; events deduped by unique key; state machine forbids illegal transitions.
- Client can never: set prices/totals, mark an order paid, apply arbitrary discounts, or reference another user's cart/order (check cart cookie scoping and order lookup by unguessable token, not sequential id, on public confirmation pages).
- Idempotency keys: unguessable, single-use semantics correct, no cross-user replay.
- Refund endpoint: admin-only, amount ≤ captured amount, audited.

### B. Injection & input handling
- Every server action / API route parses input with Zod before use; check for any handler reading `req.json()`/formData fields directly.
- Prisma used exclusively (flag any `$queryRaw` with interpolation).
- XSS: no `dangerouslySetInnerHTML` with user-influenced data; product descriptions (admin-entered) rendered safely; email templates escape user data (order note, name, address).
- File upload (admin images): content-type + magic-byte validation, size cap, randomized storage keys, images served from storage domain not executed paths.
- Phone/address fields: length caps and character allow-lists (these get printed on labels and injected into courier APIs later).

### C. AuthN/AuthZ
- Admin middleware covers EVERY /admin route and admin API/server action (test one by one — App Router makes it easy to miss a route segment).
- Session cookie: httpOnly, Secure, SameSite, signed, reasonable expiry, rotated on login; logout invalidates.
- Password: bcrypt cost ≥ 12; login rate-limited; no user enumeration in error messages; no credentials or hashes in client bundles (`grep` the .next output).
- CSRF: mutations rely on server actions' origin checks or explicit token — verify POST from foreign origin is rejected.

### D. Secrets & configuration
- No secrets in the repo, client bundles, or NEXT_PUBLIC_ vars (grep for PAYMOB, HMAC, RESEND, DATABASE_URL across source AND .next build output).
- env.ts fails closed on missing/invalid vars; distinct sandbox vs production Paymob keys; .env* in .gitignore; check git history for previously committed secrets.
- Error responses and logs: no stack traces to clients in prod; logs exclude webhook payloads' secrets, full addresses, and any card-adjacent data.

### E. Platform & headers
- Security headers on all responses: CSP (no unsafe-inline where avoidable; document exceptions), HSTS, X-Frame-Options/frame-ancestors deny (except any page Paymob legitimately frames — verify against their integration docs and scope narrowly), Referrer-Policy, Permissions-Policy.
- Rate limiting present on: checkout creation, webhook, admin login, contact/newsletter endpoints. Note in the report that in-memory limiting doesn't survive multi-instance deploys and record the upgrade path.
- Dependencies: `npm audit` — fix criticals/highs; pin or note the rest.
- Redirect handling: any redirect URL parameters validated against an allow-list (open-redirect check on post-payment return).

### F. Privacy & data minimization
- We store only what fulfilment needs; confirm no accidental storage of Paymob payloads containing more than needed (mask before persisting rawPayload, or justify retention).
- Order confirmation page requires the emailed token, not just an order number.
- Data export/erasure: a documented manual procedure in RUNBOOK.md is acceptable at this stage — verify it exists.

## Rules of engagement
- Defensive scope only: verify, fix, regression-test. Do not create attack tooling beyond the minimal test cases needed to prove a fix (e.g., a Playwright test posting a forged-signature webhook and asserting 401 is in scope).
- Never print real secrets in the report; refer to env var names.
- If a finding requires a product decision (e.g., CSP exception for Paymob), present options with a recommendation instead of guessing.

Start with area A. After each area, show me the findings table before applying fixes.
