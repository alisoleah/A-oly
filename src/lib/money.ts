/**
 * Money module — the single most safety-critical part of the storefront.
 *
 * RULES (CLAUDE.md §Money, non-negotiable #1):
 *  - All amounts are integer piasters (EGP × 100). Type alias `Piasters`.
 *  - No floats, no parseFloat on money, ever.
 *  - Display only via formatPrice(); storage only as integers.
 *
 * Why integers: floating point can't represent 0.1 exactly. 0.1 + 0.2 = 0.30000000000000004.
 * For an e-commerce checkout that is unacceptable. We store the minor unit (piasters)
 * and only format to a display string at the boundary.
 */

/** Integer piasters = EGP × 100. Branding of number, not a runtime guard. */
export type Piasters = number;

/** True when n is a non-negative integer suitable for storing as money. */
export function isPiasters(n: unknown): n is Piasters {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 0 &&
    n <= Number.MAX_SAFE_INTEGER
  );
}

/** Assert a value is safe integer money; throws otherwise. Use at trust boundaries. */
export function assertPiasters(n: unknown, label = "amount"): Piasters {
  if (!isPiasters(n)) {
    throw new TypeError(`${label} must be a non-negative integer (got ${n})`);
  }
  return n;
}

/**
 * Convert integer piasters → display string "EGP 3,200".
 * Negative input throws — money in this store is never negative.
 *
 * @example formatPrice(320000)   → "EGP 3,200"
 * @example formatPrice(0)        → "EGP 0"
 * @example formatPrice(3299)     → "EGP 32.99"
 */
export function formatPrice(
  piasters: Piasters,
  opts: { currency?: string; locale?: string } = {},
): string {
  assertPiasters(piasters);
  const { currency = "EGP", locale = "en-EG" } = opts;

  const major = Math.trunc(piasters / 100);
  const minor = piasters % 100;

  const majorStr = major.toLocaleString(locale);
  const display =
    minor === 0
      ? `${currency} ${majorStr}`
      : `${currency} ${majorStr}.${String(minor).padStart(2, "0")}`;
  return display;
}

/** Piasters → number of major EGP units, for analytics/logs only (never stored). */
export function toMajor(piasters: Piasters): number {
  assertPiasters(piasters);
  return piasters / 100;
}

/**
 * Safe summation of piasters. Guards against overflow at the boundary —
 * a cart subtotal should never exceed safe-integer range, but we check anyway
 * because money code is paranoid by design.
 */
export function sumPiasters(...amounts: Piasters[]): Piasters {
  let total = 0;
  for (const a of amounts) {
    assertPiasters(a);
    total += a;
  }
  assertPiasters(total, "sum");
  return total;
}

/** Multiply a unit price by a quantity, returning integer piasters. */
export function multiplyPrice(unitAmount: Piasters, qty: number): Piasters {
  assertPiasters(unitAmount, "unitAmount");
  if (!Number.isInteger(qty) || qty < 0) {
    throw new TypeError(`qty must be a non-negative integer (got ${qty})`);
  }
  const result = unitAmount * qty;
  assertPiasters(result, "line total");
  return result;
}
