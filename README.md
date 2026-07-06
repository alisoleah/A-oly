# aïoly — storefront

Custom direct-to-consumer storefront for **aïoly**, a premium women's fashion house
("maison de mode"). Brand promise: *one perfect piece*. Egypt first, Gulf later.

## Stack

- **Next.js 15** (App Router, TypeScript strict, React Server Components)
- **Tailwind CSS 4** with a fixed brand token set (see `design-system.md`)
- **Prisma** + SQLite in dev, **Postgres (Supabase)** in production
- **Zod** validation on every external input (API, server actions, webhooks, env)
- **Vitest** (unit/integration) + **Playwright** (e2e)

## Quick start

```bash
npm install
cp .env.example .env          # then fill in values
npm run db:migrate            # create the SQLite dev DB
npm run seed                  # load the 5 launch styles
npm run dev                   # http://localhost:3000
```

## Commands

| script | what it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build |
| `npm run typecheck` | `tsc --noEmit` (must be clean) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit + integration |
| `npm run test:e2e` | Playwright against built app (mock provider) |
| `npm run seed` | seed the 5 launch styles |
| `npm run db:migrate` / `db:deploy` / `db:studio` | Prisma migrations + studio |
| `npm run preflight` | production-readiness policy checks (run before deploy) |

## Project docs

- `CLAUDE.md` — architecture rules, data model, payment seam, security baseline
- `design-system.md` — tokens, type scale, components, motion
- `implementation-roadmap.md` — phased build plan (Phase 0 → 8)
- `TESTING_GUIDE.md` — test philosophy + the critical invariants
- `WORKLOG.md` — what shipped each phase
- `docs/DEPLOYMENT.md` — Supabase + Vercel deployment path

## Status

Phase 0 (Foundation) complete. See `WORKLOG.md`.
