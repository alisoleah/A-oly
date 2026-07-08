import { describe, expect, it } from "vitest";
import {
  computeHmac,
  safeEqualHex,
  verifyHmac,
} from "@/lib/payments/hmac";

/**
 * HMAC verification tests (TESTING_GUIDE.md §5 — the security-critical primitive).
 *  - Valid signature → accepted.
 *  - Invalid signature → rejected (verifyHmac returns false).
 *  - Timing-safe: comparison doesn't short-circuit on prefix.
 *  - Replay is handled at the PaymentEvent layer (eventKey UNIQUE), but the
 *    verifier itself must accept a validly-signed duplicate (it's stateless).
 */

const SECRET = "test-secret-abc123";
const MESSAGE = "order=42&amount=320000&success=true";

describe("computeHmac", () => {
  it("produces a deterministic hex digest for the same input", () => {
    const a = computeHmac(SECRET, MESSAGE);
    const b = computeHmac(SECRET, MESSAGE);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("sha512 produces a 128-char hex digest (Paymob's algorithm)", () => {
    const digest = computeHmac(SECRET, MESSAGE, "sha512");
    expect(digest).toMatch(/^[0-9a-f]{128}$/);
    // Different from sha256 for the same input — algorithms are not interchangeable.
    expect(digest).not.toBe(computeHmac(SECRET, MESSAGE, "sha256"));
  });

  it("changes entirely with a different message (avalanche)", () => {
    expect(computeHmac(SECRET, MESSAGE)).not.toBe(
      computeHmac(SECRET, MESSAGE + "x"),
    );
  });

  it("changes entirely with a different secret", () => {
    expect(computeHmac(SECRET, MESSAGE)).not.toBe(
      computeHmac("other-secret", MESSAGE),
    );
  });
});

describe("verifyHmac", () => {
  it("accepts a correctly-signed message", () => {
    const sig = computeHmac(SECRET, MESSAGE);
    expect(verifyHmac(SECRET, MESSAGE, sig)).toBe(true);
  });

  it("accepts a correctly-signed sha512 message (Paymob algorithm)", () => {
    const sig = computeHmac(SECRET, MESSAGE, "sha512");
    expect(verifyHmac(SECRET, MESSAGE, sig, "sha512")).toBe(true);
  });

  it("rejects a sha256 signature when verified as sha512 (algorithm mismatch)", () => {
    const sig = computeHmac(SECRET, MESSAGE, "sha256");
    expect(verifyHmac(SECRET, MESSAGE, sig, "sha512")).toBe(false);
  });

  it("rejects a tampered message (signature no longer matches)", () => {
    const sig = computeHmac(SECRET, MESSAGE);
    expect(verifyHmac(SECRET, MESSAGE + "tampered", sig)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sig = computeHmac(SECRET, MESSAGE);
    expect(verifyHmac("wrong-secret", MESSAGE, sig)).toBe(false);
  });

  it("rejects a forged signature", () => {
    expect(verifyHmac(SECRET, MESSAGE, "deadbeef".repeat(8))).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifyHmac(SECRET, MESSAGE, "")).toBe(false);
  });

  it("is stateless — a validly-signed duplicate still verifies (replay handled upstream)", () => {
    const sig = computeHmac(SECRET, MESSAGE);
    // The verifier accepts the same valid signature twice; dedupe is the
    // PaymentEvent.eventKey UNIQUE constraint's job.
    expect(verifyHmac(SECRET, MESSAGE, sig)).toBe(true);
    expect(verifyHmac(SECRET, MESSAGE, sig)).toBe(true);
  });
});

describe("safeEqualHex — timing safety", () => {
  it("returns true for equal digests", () => {
    const a = computeHmac(SECRET, MESSAGE);
    expect(safeEqualHex(a, a)).toBe(true);
  });

  it("returns false for unequal digests without throwing", () => {
    const a = computeHmac(SECRET, MESSAGE);
    const b = computeHmac(SECRET, "different");
    expect(safeEqualHex(a, b)).toBe(false);
  });

  it("returns false for different-length inputs (no crash)", () => {
    expect(safeEqualHex("abcd", "abcdef")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });

  it("returns false when comparing against a non-hex forged value", () => {
    const a = computeHmac(SECRET, MESSAGE);
    // same length, invalid hex chars
    expect(safeEqualHex(a, "zzzz".repeat(16))).toBe(false);
  });
});
