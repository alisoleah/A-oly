# Deployment Guide — aïoly storefront

**Supabase** hosts the Postgres database · **Vercel** hosts the Next.js app.
Both environments (local dev and production) point at the same Supabase Postgres
instance, so there's no dev/prod drift.

## Current state

The schema is already PostgreSQL (`prisma/schema.prisma`, `provider = "postgresql"`).
Migrations are checked into `prisma/migrations/` (Postgres dialect). A one-command
deploy script provisions + seeds a fresh Supabase project.

## The two connection strings (Supabase)

Supabase serves two endpoints off the same pooler host. You need **both**:

| Env var | Supabase endpoint | Port | Used for |
|---|---|---|---|
| `DATABASE_URL` | **Transaction pooler** | `6543` | The running app (Vercel functions) |
| `DIRECT_DATABASE_URL` | **Session pooler / direct** | `5432` | `prisma migrate` (DDL not allowed over the transaction pooler) |

Both come from **Supabase Dashboard → Project Settings → Database → Connection string → URI**.

> **Password with special characters must be URL-encoded.** Characters like `?`, `&`,
> `#`, `,` break the connection string silently. Encode them (e.g. `?` → `%3F`).
> The local `.env` (gitignored) holds the encoded form.

## Provisioning a Supabase project (one-time)

```bash
# 1. Create the project at supabase.com (any region, Free tier is fine).
# 2. Put both connection strings (URL-encoded password) into .env:
#      DATABASE_URL="postgresql://...pooler...:6543/postgres?pgbouncer=true&connection_limit=1"
#      DIRECT_DATABASE_URL="postgresql://...direct...:5432/postgres"
# 3. Deploy schema + seed:
npm run deploy-db
```

`npm run deploy-db` validates the URLs, applies migrations via the direct connection,
then seeds the 5 launch styles via the pooler. Safe to re-run (idempotent upserts).

Verify in the Supabase Dashboard → **Table Editor** → you should see Product, Variant,
Price, Image tables populated.

## Vercel hosting

1. Push the repo to GitHub (already done: `github.com/alisoleah/A-oly`).
2. vercel.com → **Add New → Project** → import `alisoleah/A-oly`. Vercel auto-detects Next.js.
3. **Environment Variables** (Settings → Environment Variables) — copy from `.env.example`
   and fill production values. The essential set:

   | var | value |
   |---|---|
   | `DATABASE_URL` | Supabase **pooler** string (port 6543), `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_DATABASE_URL` | Supabase **direct** string (port 5432) |
   | `NODE_ENV` | `production` |
   | `ADMIN_EMAIL` | your real admin email |
   | `ADMIN_PASSWORD_HASH` | output of `npx tsx scripts/hash-password.ts "<your password>"` |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `PAYMENT_PROVIDER` | `mock` (until Paymob keys are ready) |
   | `EMAIL_PROVIDER` | `console` (staging) / `resend` (prod, + `RESEND_API_KEY`) |
   | `APP_BASE_URL` | your Vercel domain (set after first deploy, or the preview URL) |
   | `SHIPPING_FEE_PIASTERS` | `6000` |
   | `FREE_SHIPPING_THRESHOLD_PIASTERS` | `500000` |
   | `COD_ENABLED_COUNTRIES` | `EG` |

4. **Deploy.** Vercel runs `npm run build` (`next build`) which generates the Prisma client.
5. (Optional) Enable `postbuild: "prisma migrate deploy"` in package.json so schema stays
   current on every deploy — only after you trust the migration history.

## Connection pooling note

Vercel functions are ephemeral and spin up many concurrent instances. Always use the
**transaction pooler** (port 6543) as the runtime `DATABASE_URL` — the pooler multiplexes
connections so you never exhaust Supabase's connection limit. Direct connections (5432)
are only for running migrations, which happen at build/deploy time, not per-request.

## Rotating the database password

If a credential leaks or for routine hygiene:
1. Supabase Dashboard → Project Settings → Database → **Reset database password**.
2. Re-encode the new password (special chars → percent-encoding).
3. Update `.env` locally and the Vercel env vars.
4. Redeploy.
