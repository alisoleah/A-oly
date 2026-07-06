import { describe, expect, it } from "vitest";
import {
  assertPiasters,
  formatPrice,
  isPiasters,
  multiplyPrice,
  sumPiasters,
} from "@/lib/money";

/**
 * Money tests — the most safety-critical unit (TESTING_GUIDE.md §1).
 * formatPrice must render piasters → "EGP 3,200" and handle 0 + odd piasters.
 * No floats ever touch money; these tests lock the integer contract.
 */
describe("formatPrice", () => {
  it("renders a whole-EGP amount with thousands separators", () => {
    expect(formatPrice(320_000)).toBe("EGP 3,200");
  });

  it("renders zero", () => {
    expect(formatPrice(0)).toBe("EGP 0");
  });

  it("renders odd piasters with two decimal places", () => {
    expect(formatPrice(3299)).toBe("EGP 32.99");
  });

  it("zero-pads single-digit piasters", () => {
    expect(formatPrice(3210)).toBe("EGP 32.10");
    expect(formatPrice(3201)).toBe("EGP 32.01");
  });

  it("formats large amounts", () => {
    expect(formatPrice(1_000_000)).toBe("EGP 10,000");
  });

  it("supports other currency codes", () => {
    expect(formatPrice(320_000, { currency: "AED" })).toBe("AED 3,200");
  });

  it("throws on negative input (money is never negative in this store)", () => {
    expect(() => formatPrice(-1)).toThrow(TypeError);
  });

  it("throws on non-integer input (no floats near money)", () => {
    expect(() => formatPrice(3.5)).toThrow(TypeError);
    expect(() => formatPrice(3)).not.toThrow();
  });

  it("rejects NaN and Infinity", () => {
    expect(() => formatPrice(Number.NaN)).toThrow(TypeError);
    expect(() => formatPrice(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("isPiasters / assertPiasters", () => {
  it("accepts non-negative integers within safe range", () => {
    expect(isPiasters(0)).toBe(true);
    expect(isPiasters(1)).toBe(true);
    expect(isPiasters(320_000)).toBe(true);
  });

  it("rejects negatives, floats, and non-numbers", () => {
    expect(isPiasters(-1)).toBe(false);
    expect(isPiasters(3.5)).toBe(false);
    expect(isPiasters(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isPiasters("100")).toBe(false);
    expect(isPiasters(null)).toBe(false);
    expect(isPiasters(undefined)).toBe(false);
  });

  it("assertPiasters returns the value when valid", () => {
    expect(assertPiasters(500, "fee")).toBe(500);
  });

  it("assertPiasters throws with the field label", () => {
    expect(() => assertPiasters(-1, "shipping")).toThrow(/shipping/);
  });
});

describe("sumPiasters", () => {
  it("sums integer amounts", () => {
    expect(sumPiasters(100, 200, 300)).toBe(600);
  });

  it("treats empty input as zero", () => {
    expect(sumPiasters()).toBe(0);
  });

  it("rejects floats in the input", () => {
    expect(() => sumPiasters(100, 0.5)).toThrow(TypeError);
  });
});

describe("multiplyPrice", () => {
  it("multiplies a unit price by an integer quantity", () => {
    expect(multiplyPrice(320_000, 2)).toBe(640_000);
  });

  it("zero quantity yields zero", () => {
    expect(multiplyPrice(320_000, 0)).toBe(0);
  });

  it("rejects negative or non-integer quantity", () => {
    expect(() => multiplyPrice(320_000, -1)).toThrow(TypeError);
    expect(() => multiplyPrice(320_000, 2.5)).toThrow(TypeError);
  });

  it("matches the seed launch prices (property: catalog integrity)", () => {
    // CLAUDE.md seed: 5 launch styles. Spot-check each EGP price ↔ piasters.
    const launch = { pants: 3200, trouser: 2900, blazer: 5500, shirt: 2200, dress: 3800 };
    for (const [name, egp] of Object.entries(launch)) {
      const piast = egp * 100;
      expect(formatPrice(piast)).toBe(`EGP ${egp.toLocaleString("en-EG")}`);
      expect(multiplyPrice(piast, 1)).toBe(piast);
      // tag unused to avoid noUnusedLocals; name documents intent
      void name;
    }
  });
});
