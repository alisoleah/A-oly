import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  computeChargeSignature,
  computeResponseSignature,
  safeEqualHex,
  piastersToEgp,
} from "@/lib/payments/fawry-provider";

/**
 * FawryPay signature verification tests.
 *
 * WHY: Fawry uses a different signature scheme than Paymob:
 *  - Plain SHA-256 (NOT HMAC-SHA-512)
 *  - A specific concatenation ORDER of fields + secureKey
 *  - Amounts in decimal EGP (not integer cents)
 *
 * A wrong field order or wrong algorithm = every callback rejected. These tests
 * pin the contract so a future regression is caught immediately.
 */

const SECURE_KEY = "fawry-test-secure-key";

function sha256(message: string): string {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

describe("piastersToEgp", () => {
  it("converts integer piasters to 2-decimal EGP string", () => {
    expect(piastersToEgp(58055)).toBe("580.55");
    expect(piastersToEgp(320000)).toBe("3200.00");
    expect(piastersToEgp(0)).toBe("0.00");
  });
});

describe("computeChargeSignature", () => {
  it("produces a deterministic SHA-256 hex digest", () => {
    const sig = computeChargeSignature({
      merchantCode: "12345",
      merchantRefNum: "AIY-000001",
      customerProfileId: "customer@example.com",
      returnUrl: "https://example.com/return",
      itemId: "order",
      quantity: "1",
      price: "3200.00",
      secureKey: SECURE_KEY,
    });
    expect(sig).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("matches a manually computed digest (field order verified)", () => {
    const fields = {
      merchantCode: "12345",
      merchantRefNum: "AIY-000001",
      customerProfileId: "cust@example.com",
      returnUrl: "https://example.com/return",
      itemId: "order",
      quantity: "1",
      price: "580.55",
      secureKey: SECURE_KEY,
    };
    // The documented concatenation order:
    const manualMessage =
      fields.merchantCode +
      fields.merchantRefNum +
      fields.customerProfileId +
      fields.returnUrl +
      fields.itemId +
      fields.quantity +
      fields.price +
      fields.secureKey;

    expect(computeChargeSignature(fields)).toBe(sha256(manualMessage));
  });

  it("changes entirely with a different secure key", () => {
    const base = {
      merchantCode: "1",
      merchantRefNum: "r",
      customerProfileId: "c",
      returnUrl: "u",
      itemId: "i",
      quantity: "1",
      price: "1.00",
    };
    const sigA = computeChargeSignature({ ...base, secureKey: "key-a" });
    const sigB = computeChargeSignature({ ...base, secureKey: "key-b" });
    expect(sigA).not.toBe(sigB);
  });

  it("changes entirely with a different price (tamper detection)", () => {
    const base = {
      merchantCode: "1",
      merchantRefNum: "r",
      customerProfileId: "c",
      returnUrl: "u",
      itemId: "i",
      quantity: "1",
      secureKey: SECURE_KEY,
    };
    const sigOriginal = computeChargeSignature({ ...base, price: "3200.00" });
    const sigTampered = computeChargeSignature({ ...base, price: "1.00" });
    expect(sigOriginal).not.toBe(sigTampered);
  });
});

describe("computeResponseSignature", () => {
  it("produces a valid SHA-256 hex digest", () => {
    const sig = computeResponseSignature({
      referenceNumber: "ref123",
      merchantRefNum: "AIY-000001",
      paymentAmount: "3200.00",
      orderAmount: "3200.00",
      orderStatus: "PAID",
      paymentMethod: "CARD",
      fawryFees: "0.00",
      shippingFees: "0.00",
      authNumber: "auth123",
      customerMail: "cust@example.com",
      customerMobile: "01012345678",
      secureKey: SECURE_KEY,
    });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches a manually computed digest (field order verified)", () => {
    const f = {
      referenceNumber: "987654",
      merchantRefNum: "AIY-100042",
      paymentAmount: "580.55",
      orderAmount: "580.55",
      orderStatus: "PAID",
      paymentMethod: "PAYATFAWRY",
      fawryFees: "5.00",
      shippingFees: "0.00",
      authNumber: "",
      customerMail: "test@example.com",
      customerMobile: "01111111111",
      secureKey: SECURE_KEY,
    };
    // The documented callback field order:
    const manualMessage =
      f.referenceNumber +
      f.merchantRefNum +
      f.paymentAmount +
      f.orderAmount +
      f.orderStatus +
      f.paymentMethod +
      f.fawryFees +
      f.shippingFees +
      f.authNumber +
      f.customerMail +
      f.customerMobile +
      f.secureKey;

    expect(computeResponseSignature(f)).toBe(sha256(manualMessage));
  });

  it("changes when orderStatus changes (tamper detection)", () => {
    const base = {
      referenceNumber: "r",
      merchantRefNum: "m",
      paymentAmount: "1.00",
      orderAmount: "1.00",
      paymentMethod: "CARD",
      fawryFees: "0",
      shippingFees: "0",
      authNumber: "",
      customerMail: "a@b.com",
      customerMobile: "01000000000",
      secureKey: SECURE_KEY,
    };
    const paidSig = computeResponseSignature({ ...base, orderStatus: "PAID" });
    const failedSig = computeResponseSignature({ ...base, orderStatus: "Failed" });
    expect(paidSig).not.toBe(failedSig);
  });

  it("rejects a reordered field list (canonical order enforced)", () => {
    const f = {
      referenceNumber: "987",
      merchantRefNum: "AIY-1",
      paymentAmount: "5.00",
      orderAmount: "5.00",
      orderStatus: "PAID",
      paymentMethod: "CARD",
      fawryFees: "0",
      shippingFees: "0",
      authNumber: "",
      customerMail: "a@b.com",
      customerMobile: "010",
      secureKey: SECURE_KEY,
    };
    // Correct order
    const correct = computeResponseSignature(f);
    // Wrong order (paymentMethod before orderStatus)
    const wrongMessage =
      f.referenceNumber + f.merchantRefNum + f.paymentAmount + f.orderAmount +
      f.paymentMethod + f.orderStatus +  // swapped
      f.fawryFees + f.shippingFees + f.authNumber + f.customerMail + f.customerMobile + f.secureKey;
    expect(correct).not.toBe(sha256(wrongMessage));
  });
});

describe("safeEqualHex — timing safety", () => {
  it("returns true for equal digests", () => {
    const a = sha256("test");
    expect(safeEqualHex(a, a)).toBe(true);
  });

  it("returns false for unequal digests without throwing", () => {
    expect(safeEqualHex(sha256("a"), sha256("b"))).toBe(false);
  });

  it("returns false for different-length inputs", () => {
    expect(safeEqualHex("abcd", "abcdef")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});
