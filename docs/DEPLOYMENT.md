# Deployment Guide — aïoly storefront

Two target platforms: **Supabase** (Postgres database) + **Vercel** (Next.js hosting).
Local dev uses SQLite; production uses Postgres. This document is the exact path.

## Why Postgres for production

SQLite is a single file — fine locally, wrong for a stateless host like Vercel where
each serverless instance has its own ephemeral filesystem. Supabase gives us a managed
Postgres with connection pooling, which is what we need.

## The schema is already provider-agnostic

`prisma/schema.prisma` uses no SQLite-specific features:
- Enums (`Collection`, `Size`, `OrderStatus`, `PaymentMethod`) — stored as TEXT on
  SQLite, become real `ENUM` types on Postgres.
- `cuid()` IDs, `@unique` constraints, JSON-via-STRING columns — all portable.
- App code uses Prisma exclusively (no raw SQL, no `$queryRaw`). Switching providers
  touches **one line** of the schema.

## Switching to Supabase (the 4 steps)

### 1. Create the Supabase project
- supabase.com → New Project → pick a region close to your users (for Egypt: eu-central / Frankfurt is a reasonable default).
- Wait for it to provision. Note the **Connection string** (URI format), the pooling port (`6543`) and the direct port (`5432`).

### 2. Flip the provider + connect
In `prisma/schema.prisma`, change:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Set `DATABASE_URL` to the Supabase **direct** connection string for migrations
(direct connection uses port `5433`; pooling on `6543` is for the running app):

```
DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

> Supabase provides both a "Direct connection" and a "Transaction pooler" string in
> Dashboard → Project Settings → Database → Connection string. Use **Direct** for
> `prisma migrate`, and the **pooler** URL for the runtime `DATABASE_URL` on Vercel.

### 3. Generate a Postgres migration + apply

The existing `prisma/migrations/` was generated against SQLite. For a fresh Postgres DB,
reset the migrations to the Postgres dialect:

```bash
# one-time, against the Supabase DB
rm -rf prisma/migrations          # remove the SQLite-flavored baseline
npx prisma migrate dev --name init   # regenerates init for Postgres + applies it
npm run seed                       # load the 5 launch styles
```

In ongoing CI/deploys, use `prisma migrate deploy` (never `migrate dev` in prod).

### 4. Run the preflight, then deploy

```bash
npm run preflight   # production policy checks (provider, email, secret length)
```

## Vercel hosting

1. Push the repo to GitHub (already done).
2. vercel.com → New Project → import the repo. Vercel auto-detects Next.js.
3. Set environment variables (Dashboard → Settings → Environment Variables). Copy from `.env.example` and fill production values:

   | var | prod value |
   |---|---|
   | `DATABASE_URL` | Supabase **pooler** connection string (port 6543) |
   | `NODE_ENV` | `production` |
   | `ADMIN_EMAIL` | your real admin email |
   | `ADMIN_PASSWORD_HASH` | output of `npx tsx scripts/hash-password.ts` |
   | `SESSION_SECRET` | `openssl rand -hex 32` |
   | `PAYMENT_PROVIDER` | `paymob` |
   | `PAYMOB_*` | sandbox keys for staging, live keys for prod |
   | `EMAIL_PROVIDER` | `resend` (+ `RESEND_API_KEY`, `EMAIL_FROM`) |
   | `APP_BASE_URL` | your Vercel domain |

4. Deploy. Vercel runs `npm run build` (which runs `prisma generate` via postinstall
   if you add it — see below).

### Optional: auto-run migrations on deploy

Add to `package.json` a `postbuild` that runs `prisma migrate deploy` so schema is
always current. (Only enable once you trust the migration history.)

```json
"postbuild": "prisma migrate deploy && prisma generate"
```

## Connection pooling note

Supabase's free tier allows limited direct connections. For a serverless host like
Vercel, always use the **pooler** URL (`...pooler.supabase.com:6543`) as the runtime
`DATABASE_URL` to avoid exhausting connection slots. Direct connections (port 5432)
are only for running migrations.
