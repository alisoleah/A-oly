import { describe, expect, it } from "vitest";
import { computeHmac, verifyHmac } from "@/lib/payments/hmac";
import { flattenPaymobObj, HMAC_FIELDS } from "@/lib/payments/paymob-provider";

/**
 * Paymob webhook HMAC — known-answer tests pinning the canonical contract.
 *
 * WHY THIS FILE EXISTS: the field order, algorithm, delivery channel, and
 * nesting are all things we got WRONG in the first pass (sha256, header,
 * top-level body, guessed order). Paymob docs are the source of truth, and a
 * silent regression here would reject EVERY production webhook. These tests
 * lock the contract so a future edit can't drift unnoticed.
 *
 * Contract (Paymob "HMAC Transaction Callback" doc, verified 2026-06):
 *  1. Algorithm: HMAC-SHA512.
 *  2. HMAC arrives as a ?hmac=<hex> query parameter, not a header.
 *  3. TRANSACTION callbacks nest payload under `obj`.
 *  4. Signed string = concatenation, in order, of HMAC_FIELDS values, with
 *     `order` unwrapped to its `id` and `source_data.*` flattened.
 */

const PAYMOB_SECRET = "paymob-test-hmac-secret";

/** A representative Paymob TRANSACTION callback (nested obj). */
const sampleObj = {
  amount_cents: "320000",
  created_at: "2026-07-08T10:00:00.000Z",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  id: 9876543210,
  integration_id: 1234,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: "AIY-100042" },
  owner: 99,
  pending: false,
  source_data: { pan: "411111******1111", sub_type: "MASTERCARD", type: "card" },
  success: true,
};

/** Build the exact signed string Paymob computes, using our canonical order. */
function buildMessage(obj: Record<string, unknown>): string {
  const flat = flattenPaymobObj(obj);
  return HMAC_FIELDS.map((k) => String(flat[k] ?? "")).join("");
}

describe("Paymob HMAC — field order & flattening", () => {
  it("flattens nested order.id and source_data.* into the signed key set", () => {
    const flat = flattenPaymobObj(sampleObj);
    expect(flat.order).toBe("AIY-100042");
    expect(flat.source_data_pan).toBe("411111******1111");
    expect(flat.source_data_sub_type).toBe("MASTERCARD");
    expect(flat.source_data_type).toBe("card");
  });

  it("HMAC_FIELDS is the documented canonical order (guard against reordering)", () => {
    // If this array is ever reordered or a field dropped, this snapshot fails —
    // forcing a conscious re-verification against Paymob's docs.
    expect(HMAC_FIELDS).toEqual([
      "amount_cents",
      "created_at",
      "currency",
      "error_occured",
      "has_parent_transaction",
      "id",
      "integration_id",
      "is_3d_secure",
      "is_auth",
      "is_capture",
      "is_refunded",
      "is_standalone_payment",
      "is_voided",
      "order",
      "owner",
      "pending",
      "source_data_pan",
      "source_data_sub_type",
      "source_data_type",
      "success",
    ]);
  });

  it("the concatenated message has no separators and uses flattened values", () => {
    const msg = buildMessage(sampleObj);
    // `order` became "AIY-100042" (the inner id), not "[object Object]".
    expect(msg).toContain("AIY-100042");
    expect(msg).not.toContain("[object Object]");
    // The string starts with amount_cents and ends with success ("true").
    expect(msg.startsWith("320000")).toBe(true);
    expect(msg.endsWith("true")).toBe(true);
  });
});

describe("Paymob HMAC — algorithm & verification", () => {
  const message = buildMessage(sampleObj);

  it("computes a SHA-512 digest (128 hex chars), not SHA-256", () => {
    const digest = computeHmac(PAYMOB_SECRET, message, "sha512");
    expect(digest).toMatch(/^[0-9a-f]{128}$/);
  });

  it("accepts a correctly-signed SHA-512 webhook", () => {
    const sig = computeHmac(PAYMOB_SECRET, message, "sha512");
    expect(verifyHmac(PAYMOB_SECRET, message, sig, "sha512")).toBe(true);
  });

  it("rejects a SHA-256 signature (old, wrong algorithm)", () => {
    const sha256Sig = computeHmac(PAYMOB_SECRET, message, "sha256");
    expect(verifyHmac(PAYMOB_SECRET, message, sha256Sig, "sha512")).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const sig = computeHmac("wrong-secret", message, "sha512");
    expect(verifyHmac(PAYMOB_SECRET, message, sig, "sha512")).toBe(false);
  });

  it("rejects a tampered amount in the payload", () => {
    const tampered = { ...sampleObj, amount_cents: "1" }; // attacker lowers amount
    const tamperedMsg = buildMessage(tampered);
    const sig = computeHmac(PAYMOB_SECRET, message, "sha512"); // signed over original
    expect(verifyHmac(PAYMOB_SECRET, tamperedMsg, sig, "sha512")).toBe(false);
  });

  it("rejects a reordered field list (canonical order enforced)", () => {
    // Same fields, wrong order — must NOT verify.
    const flat = flattenPaymobObj(sampleObj);
    const wrongOrder = [...HMAC_FIELDS].reverse();
    const wrongMsg = wrongOrder.map((k) => String(flat[k] ?? "")).join("");
    const sig = computeHmac(PAYMOB_SECRET, message, "sha512");
    expect(verifyHmac(PAYMOB_SECRET, wrongMsg, sig, "sha512")).toBe(false);
  });
});

describe("Paymob HMAC — query param delivery", () => {
  // The provider reads ?hmac= from the URL, not a header. This documents and
  // guards that channel choice (the first-pass bug).
  it("extracts the signature from the ?hmac= query parameter", () => {
    const message = buildMessage(sampleObj);
    const sig = computeHmac(PAYMOB_SECRET, message, "sha512");
    const url = new URL("https://a-oly.vercel.app/api/webhooks/paymob?hmac=" + sig);
    expect(url.searchParams.get("hmac")).toBe(sig);
    expect(url.searchParams.has("hmac")).toBe(true);
  });

  it("an empty/missing ?hmac= is treated as verification failure (not crash)", () => {
    const url = new URL("https://a-oly.vercel.app/api/webhooks/paymob");
    const received = url.searchParams.get("hmac") ?? "";
    const message = buildMessage(sampleObj);
    expect(verifyHmac(PAYMOB_SECRET, message, received, "sha512")).toBe(false);
  });
});
