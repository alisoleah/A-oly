# RUNBOOK — aïoly storefront

Operational procedures for running the store. Keep this current; it's the
single source for "how do I do X in production."

## Deploy

1. Push to `main` on GitHub. Vercel auto-deploys from `main`.
2. Vercel runs `npm run build` (which runs `prisma generate`). Migrations are
   applied via a postbuild step if enabled (see below), or manually.
3. To apply a DB migration manually before a deploy:
   ```bash
   DIRECT_DATABASE_URL="postgresql://...direct...:5432/postgres" npx prisma migrate deploy
   npm run seed   # only when introducing new seed data
   ```

### Enable auto-migrate on deploy (optional)
Add to `package.json`:
```json
"postbuild": "prisma migrate deploy && prisma generate"
```

## Environment variables (rotation)

Source of truth: `.env.example`. Secrets live only in the local `.env`
(gitignored) and in Vercel's Environment Variables UI.

### Rotate the Supabase database password
The password was shared in chat during initial setup. To rotate:
1. Supabase Dashboard → Project Settings → Database → **Reset database password**.
2. Copy the new password. URL-encode any special chars (e.g. `?` → `%3F`).
3. Update both connection strings in local `.env` (`DATABASE_URL` pooler +
   `DIRECT_DATABASE_URL` direct) and in Vercel env vars.
4. Redeploy.

### Rotate the admin password
The dev admin password (`aioly-admin-2026`) is temporary. To set a real one:
```bash
npx tsx scripts/hash-password.ts "<new strong password>"
# copy the RAW hash (for Vercel dashboard) — no \$ escaping needed there
# for local .env: use the ESCAPED form the script prints
```
Set `ADMIN_PASSWORD_HASH` in `.env` (escaped) + Vercel (raw). Redeploy.

### Rotate SESSION_SECRET
```bash
openssl rand -hex 32
```
Set as `SESSION_SECRET` in `.env` + Vercel. **This signs out the current admin
session** (existing JWTs become invalid). Redeploy.

## Refund procedure

1. Sign into `/admin` → Orders → open the order.
2. If the order was paid online, trigger a refund via the provider: the
   `refund()` seam calls Paymob's refund API with `amount ≤ captured`. A
   `PaymentEvent` row of type `refund` is recorded. The order transitions
   PAID → REFUNDED only after the provider confirms.
3. For COD orders that were never collected: the order stays `PENDING_COD`
   (no money moved). Cancel via the order detail → the state machine allows
   `cancel` from `PENDING_COD`.
4. Stock: cancelling does NOT auto-restock (only the reservation sweep restocks
   abandoned online payments). Manually adjust stock in Products if needed.

## Webhook replay / duplicate handling

Paymob (and the mock provider) may deliver a webhook more than once. This is safe:
- Every webhook is deduped on `PaymentEvent.eventKey` (UNIQUE constraint).
- A replayed webhook finds the existing event row and is a no-op — no second
  PAID transition, no second email.
- A late webhook on an already-CANCELLED order is rejected by the state machine
  (illegal transition) and acked (200) without mutating anything.

## Reservation TTL sweep

Online-payment orders hold stock (decremented at creation) while awaiting payment.
If the customer abandons, the `/api/cron/sweep` endpoint restocks + cancels
`PENDING_PAYMENT` orders older than `RESERVATION_TTL_MINUTES` (default 30).

Schedule it (Vercel cron — add `vercel.json`):
```json
{ "crons": [{ "path": "/api/cron/sweep?secret=<CRON_SECRET>", "schedule": "*/10 * * * *" }] }
```
Set `CRON_SECRET` in env. The sweep is idempotent.

## Data export / erasure (privacy)

Customer data is limited to order records (name, email, phone, shipping
address) and cart rows. There is no customer account system yet.

### Export a customer's data (manual, on request)
```sql
SELECT * FROM "Order" WHERE email = '<customer email>';
SELECT * FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE email = '<customer email>');
```
Export via Supabase Dashboard → Table Editor → CSV, or `prisma studio`.

### Erase a customer's data (manual, on request)
Orders required for accounting/fulfilment are NOT deleted — instead, redact PII:
```sql
UPDATE "Order"
SET email = 'redacted@aioly.eg',
    phone = 'redacted',
    "shippingAddress" = '{"redacted": true}'
WHERE email = '<customer email>';
```
Cart rows can be deleted outright — they're ephemeral.

## Incident: "orders aren't being marked PAID"

1. Check Paymob dashboard for the transaction status.
2. Check Supabase `PaymentEvent` table for recent rows — did the webhook arrive?
3. Check Vercel logs for `/api/webhooks/paymob` errors (signature failures → 401).
4. Verify `PAYMOB_HMAC_SECRET` matches the Paymob dashboard exactly.
5. If the webhook never arrived: confirm the webhook URL in the Paymob dashboard
   points at the **deployed** `/api/webhooks/paymob` endpoint (not localhost).

## Incident: "oversell" (stock went negative)

This should be impossible (atomic conditional decrement + state machine). If seen:
1. Check whether a manual DB edit bypassed the order-creation transaction.
2. The concurrency test (`tests/integration/checkout.concurrency.test.ts`)
   proves the guard; a real oversell implies the guard was bypassed, not failed.
