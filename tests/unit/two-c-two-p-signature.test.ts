import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  computeRequestSignature,
  computeResponseSignature,
  piastersToAmount,
  amountToPiasters,
} from "@/lib/payments/two-c-two-p-provider";

/**
 * 2C2P signature verification tests.
 *
 * 2C2P uses HMAC-SHA256 (like our mock provider, NOT Fawry's plain SHA-256,
 * and NOT Paymob's HMAC-SHA-512). These tests pin the contract.
 */

const SECRET_KEY = "2c2p-test-secret-key";

function hmacSha256(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

describe("piastersToAmount / amountToPiasters", () => {
  it("converts piasters to 2C2P decimal amount string", () => {
    expect(piastersToAmount(58055)).toBe("580.55");
    expect(piastersToAmount(320000)).toBe("3200.00");
    expect(piastersToAmount(0)).toBe("0.00");
  });

  it("round-trips piasters → amount → piasters", () => {
    expect(amountToPiasters(piastersToAmount(58055))).toBe(58055);
    expect(amountToPiasters(piastersToAmount(320000))).toBe(320000);
  });
});

describe("computeRequestSignature", () => {
  it("produces a deterministic HMAC-SHA256 hex digest", () => {
    const sig = computeRequestSignature('{"test":true}', SECRET_KEY);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches a manually computed HMAC-SHA256", () => {
    const payload = '{"merchantID":"TEST","amount":"3200.00"}';
    expect(computeRequestSignature(payload, SECRET_KEY)).toBe(
      hmacSha256(SECRET_KEY, payload),
    );
  });

  it("changes with a different secret key", () => {
    const payload = '{"test":true}';
    expect(computeRequestSignature(payload, "key-a")).not.toBe(
      computeRequestSignature(payload, "key-b"),
    );
  });

  it("changes with a different payload (tamper detection)", () => {
    expect(computeRequestSignature('{"amount":"3200.00"}', SECRET_KEY)).not.toBe(
      computeRequestSignature('{"amount":"1.00"}', SECRET_KEY),
    );
  });
});

describe("computeResponseSignature", () => {
  const baseParams = {
    merchantID: "TEST001",
    invoiceNo: "AIY-000001",
    respCode: "000",
    respDesc: "Success",
    amount: "3200.00",
    currencyCode: "EGP",
    tranRef: "TRX123",
    approvalCode: "APP456",
    eci: "05",
    tranDateTime: "20260710120000",
    status: "000",
    failReason: "",
    userDefined1: "",
    userDefined2: "",
    userDefined3: "",
    userDefined4: "",
    userDefined5: "",
    secretKey: SECRET_KEY,
  };

  it("produces a valid HMAC-SHA256 hex digest", () => {
    expect(computeResponseSignature(baseParams)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches a manually computed HMAC over the documented field order", () => {
    const msg =
      baseParams.merchantID +
      baseParams.invoiceNo +
      baseParams.respCode +
      baseParams.respDesc +
      baseParams.amount +
      baseParams.currencyCode +
      baseParams.tranRef +
      baseParams.approvalCode +
      baseParams.eci +
      baseParams.tranDateTime +
      baseParams.status +
      baseParams.failReason +
      baseParams.userDefined1 +
      baseParams.userDefined2 +
      baseParams.userDefined3 +
      baseParams.userDefined4 +
      baseParams.userDefined5;

    expect(computeResponseSignature(baseParams)).toBe(
      hmacSha256(SECRET_KEY, msg),
    );
  });

  it("changes when respCode changes (tamper detection)", () => {
    const success = computeResponseSignature({ ...baseParams, respCode: "000" });
    const failed = computeResponseSignature({ ...baseParams, respCode: "099" });
    expect(success).not.toBe(failed);
  });

  it("rejects a reordered field list (canonical order enforced)", () => {
    // Correct order
    const correct = computeResponseSignature(baseParams);
    // Wrong order (amount before respDesc)
    const wrongMsg =
      baseParams.merchantID + baseParams.invoiceNo +
      baseParams.respCode + baseParams.amount +        // swapped
      baseParams.respDesc +                            // swapped
      baseParams.currencyCode + baseParams.tranRef +
      baseParams.approvalCode + baseParams.eci +
      baseParams.tranDateTime + baseParams.status +
      baseParams.failReason +
      baseParams.userDefined1 + baseParams.userDefined2 +
      baseParams.userDefined3 + baseParams.userDefined4 +
      baseParams.userDefined5;
    expect(correct).not.toBe(hmacSha256(SECRET_KEY, wrongMsg));
  });
});
