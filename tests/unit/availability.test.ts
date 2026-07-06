import { describe, expect, it } from "vitest";
import {
  availableStock,
  isInStock,
  maxAddableQty,
  MAX_QTY_PER_LINE,
  resolveVariant,
  sizesByColorway,
  type ResolvableVariant,
} from "@/lib/availability";

/**
 * Availability + variant resolution tests.
 * These guard the safety-critical stock math (TESTING_GUIDE.md §2) and the
 * PDP variant-selection logic (Phase 1 acceptance: OOS sizes disabled).
 */

const variants: ResolvableVariant[] = [
  { id: "1", colorway: "Ivory", size: "XS" },
  { id: "2", colorway: "Ivory", size: "S" },
  { id: "3", colorway: "Ink", size: "M" },
  { id: "4", colorway: "Ink", size: "L" },
];

describe("availableStock", () => {
  it("returns stock minus reserved", () => {
    expect(availableStock(6, 0)).toBe(6);
    expect(availableStock(6, 2)).toBe(4);
    expect(availableStock(1, 1)).toBe(0);
  });

  it("never returns negative", () => {
    expect(availableStock(0, 5)).toBe(0);
    expect(availableStock(2, 5)).toBe(0);
  });

  it("rejects non-integers (money-adjacent code is paranoid)", () => {
    expect(() => availableStock(6.5, 0)).toThrow(TypeError);
    expect(() => availableStock(6, 0.5)).toThrow(TypeError);
  });
});

describe("isInStock", () => {
  it("is true when available > 0", () => {
    expect(isInStock(6, 0)).toBe(true);
    expect(isInStock(1, 0)).toBe(true);
  });

  it("is false when fully reserved or out of stock", () => {
    expect(isInStock(0, 0)).toBe(false);
    expect(isInStock(6, 6)).toBe(false);
    expect(isInStock(6, 10)).toBe(false);
  });
});

describe("maxAddableQty", () => {
  it("caps at available stock", () => {
    expect(maxAddableQty(3, 0)).toBe(3);
    expect(maxAddableQty(6, 4)).toBe(2);
  });

  it("caps at MAX_QTY_PER_LINE even with ample stock", () => {
    expect(maxAddableQty(100, 0)).toBe(MAX_QTY_PER_LINE);
  });

  it("is zero when out of stock", () => {
    expect(maxAddableQty(0, 0)).toBe(0);
    expect(maxAddableQty(5, 5)).toBe(0);
  });
});

describe("resolveVariant", () => {
  it("finds an exact colorway+size match", () => {
    expect(resolveVariant(variants, "Ivory", "S")?.id).toBe("2");
    expect(resolveVariant(variants, "Ink", "L")?.id).toBe("4");
  });

  it("is case-insensitive on both fields", () => {
    expect(resolveVariant(variants, "ivory", "xs")?.id).toBe("1");
    expect(resolveVariant(variants, "INK", "m")?.id).toBe("3");
  });

  it("returns null for a non-existent combination", () => {
    expect(resolveVariant(variants, "Ivory", "L")).toBeNull();
    expect(resolveVariant(variants, "Sand", "M")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(resolveVariant([], "Ivory", "S")).toBeNull();
  });
});

describe("sizesByColorway", () => {
  it("groups sizes under each colorway", () => {
    const map = sizesByColorway(variants);
    expect(map.get("Ivory")).toEqual(["XS", "S"]);
    expect(map.get("Ink")).toEqual(["M", "L"]);
  });

  it("handles a single colorway", () => {
    const map = sizesByColorway([variants[0]!, variants[1]!]);
    expect(map.size).toBe(1);
    expect(map.get("Ivory")).toEqual(["XS", "S"]);
  });
});
