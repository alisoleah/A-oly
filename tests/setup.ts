// Vitest global setup — shared across all unit/integration test files.
//
// Unit tests stay pure (never touch the DB), so a harmless DATABASE_URL is fine.
// Integration tests run against the REAL Supabase DB — they read DATABASE_URL +
// DIRECT_DATABASE_URL from .env. We load .env here so the Supabase URL wins for
// integration tests without touching the unit-test path.
//
// Load order: this file runs before any test module imports prisma, so the env
// is correct before the Prisma client is constructed.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Best-effort .env loader (no dotenv dep — CLAUDE.md asks before adding deps).
try {
  const envPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/);
    const key = m?.[1];
    const val = m?.[2];
    if (key && val !== undefined && !process.env[key]) {
      process.env[key] = val;
    }
  }
} catch {
  // .env may not exist in CI; CI sets env vars directly. That's fine.
}

// Defaults for any vars still missing (unit tests never use the DB, so these
// just keep the env validator happy at import time).
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "file:./test.db";
(process.env as Record<string, string>).NODE_ENV =
  process.env.NODE_ENV ?? "test";
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? "mock";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-session-secret-32-bytes-min-x";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@aioly.test";
process.env.ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ??
  "$2a$12$ciplaceholderhashxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
