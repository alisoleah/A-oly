// Vitest global setup — shared across all unit/integration test files.
// Per TESTING_GUIDE.md: integration tests hit a real test DB; unit tests stay pure.

// Default to a test DB so any module that touches prisma at import time stays safe.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "file:./test.db";
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.PAYMENT_PROVIDER = "mock";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-session-secret-32-bytes-min-x";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@aioly.test";
process.env.ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ??
  "$2a$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUV1234567890abcdefghijklmnopqrstuv";
