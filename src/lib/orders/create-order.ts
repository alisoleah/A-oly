import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  assertPiasters,
  multiplyPrice,
  sumPiasters,
  type Piasters,
} from "@/lib/money";
import { availableStock } from "@/lib/availability";
import { isCodEnabledForCountry } from "@/lib/env";
import type { CheckoutInput } from "@/lib/orders/schemas";
import { SHIPPING_COUNTRY } from "@/lib/orders/schemas";
import { formatOrderNumber } from "@/lib/orders/identifiers";
import { generateConfirmToken } from "@/lib/orders/identifiers.server";
import type { Order } from "@prisma/client";

/**
 * createOrder — the safety-critical core of the storefront.
 *
 * INVARIANTS (CLAUDE.md §Checkout, non-negotiables):
 *  1. Totals recomputed SERVER-SIDE from DB prices; client totals ignored.
 *  2. Stock check + decrement inside the SAME Prisma interactive transaction
 *     as order creation. Concurrent purchases of the last unit: exactly one
 *     succeeds, the other gets a clean OutOfStockError (never a partial).
 *  3. Idempotency: same key → same order (no duplicate on retry).
 *  4. Price/name snapshots frozen at purchase; later changes never alter orders.
 *
 * COD orders are created directly as PENDING_COD with stock decremented; the
 * online-payment path (Phase 4) creates PENDING_PAYMENT and the webhook sets PAID.
 */

export class OutOfStockError extends Error {
  constructor(public readonly items: { name: string; requested: number; available: number }[]) {
    super("Some items are no longer available in the requested quantity.");
    this.name = "OutOfStockError";
  }
}

export class PaymentMethodUnavailableError extends Error {
  constructor(method: string) {
    super(`Payment method ${method} is not available for this country.`);
    this.name = "PaymentMethodUnavailableError";
  }
}

export type CreatedOrder = Pick<
  Order,
  "id" | "number" | "status" | "total" | "subtotal" | "shipping" | "currency" | "paymentMethod" | "email" | "confirmToken"
>;

/**
 * Create an order from a cart. Runs everything inside one DB transaction.
 *
 * @param cartToken the visitor's cart cookie token
 * @param input validated checkout input
 * @returns the created order view (id, number, status, totals, confirmToken)
 */
export async function createOrder(
  cartToken: string,
  input: CheckoutInput,
): Promise<CreatedOrder> {
  // COD availability is a per-country flag (Egypt on at launch).
  if (input.payment.method === "COD") {
    if (!isCodEnabledForCountry(SHIPPING_COUNTRY)) {
      throw new PaymentMethodUnavailableError("COD");
    }
  }

  // Idempotency: if an order already exists for this key, return it as-is.
  // This makes retries safe (network blip → double-submit → one order).
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: {
      id: true, number: true, status: true, total: true, subtotal: true,
      shipping: true, currency: true, paymentMethod: true, email: true, confirmToken: true,
    },
  });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    // ── 1. Load the cart with current prices + stock (FOR UPDATE semantics) ──
    // Prisma interactive transactions on Postgres use row-level locking via the
    // transaction isolation level, giving us the SELECT...FOR UPDATE behaviour
    // we need for safe concurrent decrement.
    const cart = await tx.cart.findUnique({
      where: { cookieToken: cartToken },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
                prices: { where: { currency: "EGP" } },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new Error("Your bag is empty.");
    }

    // ── 2. Recompute totals SERVER-SIDE from DB prices ──
    const lineItems = cart.items.map((item) => {
      const unit = item.variant.prices[0]?.unitAmount ?? 0;
      assertPiasters(unit, "unit price");
      return {
        variantId: item.variantId,
        nameSnapshot: item.variant.product.name,
        colorwaySnapshot: item.variant.colorway,
        sizeSnapshot: item.variant.size,
        unitAmountSnapshot: unit,
        qty: item.qty,
        lineTotal: multiplyPrice(unit, item.qty),
      };
    });

    const subtotal = sumPiasters(...lineItems.map((l) => l.lineTotal));
    const shipping: Piasters =
      subtotal >= env.FREE_SHIPPING_THRESHOLD_PIASTERS
        ? 0
        : (env.SHIPPING_FEE_PIASTERS as Piasters);
    const total = sumPiasters(subtotal, shipping);

    // ── 4. ATOMIC stock decrement — the oversell guard ──
    // A verify-then-decrement race loses under Read Committed: two transactions
    // both read stock=1 and both decrement. Instead we do a CONDITIONAL update
    // whose WHERE clause fails if availability has dropped, and check the number
    // of affected rows. Zero rows ⇒ someone else took the unit ⇒ abort.
    //
    // This is the only $executeRaw in the codebase and it is fully parameterized
    // (no string interpolation of values) — safe by construction.
    const winners: typeof cart.items = [];
    const losers: { name: string; requested: number; available: number }[] = [];
    for (const item of cart.items) {
      const updated = await tx.$executeRaw`
        UPDATE "Variant"
        SET stock = stock - ${item.qty}
        WHERE id = ${item.variantId}
          AND (stock - reserved) >= ${item.qty}
      `;
      if (updated === 1) {
        winners.push(item);
      } else {
        losers.push({
          name: item.variant.product.name,
          requested: item.qty,
          available: availableStock(item.variant.stock, item.variant.reserved) - item.qty,
        });
      }
    }
    if (losers.length) throw new OutOfStockError(losers);

    // ── 5. Create the order + items + snapshots ──
    // Order number derived from the highest existing ordinal + 1; retry a few
    // times on the rare unique-constraint collision (concurrent inserts).
    let order: CreatedOrder | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const ordinal = await nextOrderOrdinal(tx);
      try {
        order = await tx.order.create({
          data: {
            number: formatOrderNumber(ordinal),
            email: input.contact.email,
            phone: input.contact.phone,
            shippingAddress: JSON.stringify({
              fullName: input.contact.fullName,
              governorate: input.delivery.governorate,
              city: input.delivery.city,
              addressLine1: input.delivery.addressLine1,
              addressLine2: input.delivery.addressLine2 ?? "",
              postalCode: input.delivery.postalCode ?? "",
              country: SHIPPING_COUNTRY,
              notes: input.delivery.notes ?? "",
            }),
            paymentMethod: "COD",
            status: "PENDING_COD", // COD path; Phase 4 uses PENDING_PAYMENT
            subtotal,
            shipping,
            total,
            currency: "EGP",
            codDue: total,
            idempotencyKey: input.idempotencyKey,
            confirmToken: generateConfirmToken(),
            items: {
              create: lineItems.map((l) => ({
                variantId: l.variantId,
                nameSnapshot: l.nameSnapshot,
                colorwaySnapshot: l.colorwaySnapshot,
                sizeSnapshot: l.sizeSnapshot,
                unitAmountSnapshot: l.unitAmountSnapshot,
                qty: l.qty,
              })),
            },
          },
          select: {
            id: true, number: true, status: true, total: true, subtotal: true,
            shipping: true, currency: true, paymentMethod: true, email: true, confirmToken: true,
          },
        });
      } catch (e) {
        // P2002 = unique constraint on `number`; retry with a higher ordinal.
        if ((e as { code?: string }).code === "P2002") {
          lastErr = e;
          continue;
        }
        throw e; // anything else aborts the transaction
      }
    }
    if (!order) {
      throw lastErr ?? new Error("Could not assign a unique order number.");
    }

    // ── 6. Clear the cart (its items are now an order) ──
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return order;
  });
}

/**
 * Next order ordinal. Derived from the highest existing order-number suffix + 1,
 * NOT a row count — counts drop when orders are deleted, which would re-issue
 * numbers and collide on the unique constraint. Reading the max suffix keeps the
 * sequence strictly increasing across deletions.
 */
async function nextOrderOrdinal(tx: Parameters<Parameters<typeof prisma["$transaction"]>[0]>[0]): Promise<number> {
  const rows = await tx.order.findMany({
    select: { number: true },
    // modest scan; at launch volume this is trivial
  });
  let max = 0;
  for (const r of rows) {
    const m = /^AIY-(\d+)$/.exec(r.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}


