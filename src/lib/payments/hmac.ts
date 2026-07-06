import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC verification utilities — the security-critical webhook primitive.
 *
 * RULES (security audit area A):
 *  - Comparison is ALWAYS timing-safe (crypto.timingSafeEqual). No `===` on
 *    signatures — that leaks length/prefix via timing.
 *  - The secret comes ONLY from env, never from the request.
 *  - Throws on mismatch; the caller treats any throw as "reject".
 */

/** Compute an HMAC-SHA256 hex digest over a message with a secret. */
export function computeHmac(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Timing-safe comparison of two hex digests.
 *
 * Both must be the same length; if not, we fail closed (return false) rather
 * than throw, so callers can branch without try/catch noise. This is the ONLY
 * acceptable way to compare a received signature against the expected one.
 */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Verify a received HMAC against the expected value, given the secret + message.
 * Pure + testable (the webhook handler builds the message per the provider's
 * documented field order, then calls this).
 */
export function verifyHmac(secret: string, message: string, receivedSignature: string): boolean {
  const expected = computeHmac(secret, message);
  return safeEqualHex(expected, receivedSignature);
}
