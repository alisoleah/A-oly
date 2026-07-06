/**
 * Stock availability — safety-critical logic shared by catalog display and cart.
 *
 * Two stock numbers exist per variant:
 *   stock     — physical units on hand
 *   reserved  — units held by PENDING_PAYMENT orders (Phase 4 reservation TTL)
 *
 * What a customer can actually buy = stock − reserved = `availableStock`.
 * Never read raw `stock` for a sell decision; always go through these helpers.
 *
 * CLAUDE.md invariant: stock is decremented atomically inside the order-creation
 * transaction; these helpers only *describe* availability — the transaction
 * *enforces* it. (See TESTING_GUIDE.md §2 oversell tests.)
 */

/** Sellable units = stock − reserved. Never negative. */
export function availableStock(stock: number, reserved: number): number {
  if (!Number.isInteger(stock) || !Number.isInteger(reserved)) {
    throw new TypeError("stock and reserved must be integers");
  }
  return Math.max(0, stock - reserved);
}

/** True when at least one unit can be bought right now. */
export function isInStock(stock: number, reserved: number): boolean {
  return availableStock(stock, reserved) > 0;
}

/**
 * Maximum quantity a customer may add for a variant. Caps at available stock and
 * a sane absolute ceiling to keep carts reasonable. Phase 2 cart enforces this
 * server-side on every mutation.
 */
export const MAX_QTY_PER_LINE = 10;

export function maxAddableQty(stock: number, reserved: number): number {
  return Math.min(MAX_QTY_PER_LINE, availableStock(stock, reserved));
}

/**
 * Variant resolution — find the exact variant a colorway+size choice maps to.
 * Pure function over a list of {colorway,size,id,...}, used by PDP + cart.
 * Returns null when the combination doesn't exist (shouldn't normally happen
 * since selectors are driven by the data, but client input is never trusted).
 */
export interface ResolvableVariant {
  id: string;
  colorway: string;
  size: string;
}

export function resolveVariant<T extends ResolvableVariant>(
  variants: T[],
  colorway: string,
  size: string,
): T | null {
  return (
    variants.find(
      (v) =>
        v.colorway.toLowerCase() === colorway.toLowerCase() &&
        v.size.toLowerCase() === size.toLowerCase(),
    ) ?? null
  );
}

/** Group variants by colorway, listing the sizes offered in each. */
export function sizesByColorway<T extends ResolvableVariant>(
  variants: T[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const v of variants) {
    const arr = map.get(v.colorway) ?? [];
    arr.push(v.size);
    map.set(v.colorway, arr);
  }
  return map;
}
