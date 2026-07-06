/**
 * One-command Supabase deploy: migrate → seed → verify.
 *
 * Usage:
 *   DATABASE_URL=postgresql://...pooler...:6543/postgres \
 *   DIRECT_DATABASE_URL=postgresql://...direct...:5432/postgres \
 *   npx tsx scripts/deploy-db.ts
 *
 * Reads connection strings from the environment (or .env). Validates the URL
 * shape before doing anything, then applies migrations to Supabase and seeds
 * the 5 launch styles. Safe to re-run (idempotent upserts).
 */
import { execSync } from "node:child_process";

function run(label: string, cmd: string) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

function checkUrl(name: string): URL {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ${name} is not set. Set it in .env or the shell environment.`);
    process.exit(1);
  }
  try {
    const u = new URL(v);
    if (!v.startsWith("postgresql://") && !v.startsWith("postgres://")) {
      throw new Error("must start with postgresql:// or postgres://");
    }
    return u;
  } catch (e) {
    console.error(`✗ ${name} is not a valid connection string: ${(e as Error).message}`);
    process.exit(1);
  }
}

console.log("aïoly — Supabase database deploy\n");

const runtime = checkUrl("DATABASE_URL");
const direct = checkUrl("DIRECT_DATABASE_URL");
console.log(`✓ DATABASE_URL        → ${runtime.host}:${runtime.port || "(default)"}`);
console.log(`✓ DIRECT_DATABASE_URL → ${direct.host}:${direct.port || "(default)"}`);

if (!runtime.hostname.includes("supabase.com") && runtime.hostname !== "db.local") {
  console.warn(
    `  note: runtime host is not a *.supabase.com pooler (${runtime.hostname}). Continuing anyway.`,
  );
}

// Migrate uses the DIRECT connection (Supabase doesn't allow DDL over the pooler).
run("Applying migrations (direct connection)", "npx prisma migrate deploy");
// Seed uses the runtime pooler (normal app traffic path).
run("Seeding the 5 launch styles", "npm run seed");

console.log("\n✓ Done. Database is live and seeded.");
