/**
 * Order identifiers — client-safe (no node: imports).
 *
 *  - `formatOrderNumber`: pure formatter, used in tests + server.
 *  - `generateIdempotencyKey`: Web Crypto API (browser + Node 20+); the checkout
 *    page mints a key client-side, so this must be importable from a client
 *    component without pulling node:crypto into the bundle.
 *
 * Server-only secrets (the unguessable confirmToken) live in identifiers.server.ts.
 */

const ORDINAL_PADDING = 6;

/** Format a sequential ordinal as a human order number, e.g. 123 → "AIY-000123". */
export function formatOrderNumber(ordinal: number): string {
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new TypeError(`ordinal must be a positive integer (got ${ordinal})`);
  }
  return `AIY-${String(ordinal).padStart(ORDINAL_PADDING, "0")}`;
}

/**
 * Mint a fresh idempotency key for a checkout attempt. Web Crypto API — safe in
 * the browser bundle.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}
