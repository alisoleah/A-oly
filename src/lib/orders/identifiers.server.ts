import { randomBytes } from "node:crypto";

/**
 * Server-only order identifiers.
 *
 * `generateConfirmToken` uses node:crypto for 32 bytes of entropy. It MUST stay
 * in this separate module so a client component importing
 * `generateIdempotencyKey` from identifiers.ts never pulls node:crypto into the
 * browser bundle.
 */

/** Mint an unguessable confirmation token (32 bytes / 256 bits of entropy). */
export function generateConfirmToken(): string {
  return randomBytes(32).toString("hex");
}
