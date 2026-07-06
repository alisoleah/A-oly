import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createOrder, OutOfStockError } from "@/lib/orders/create-order";
import type { CheckoutInput } from "@/lib/orders/schemas";
import { generateIdempotencyKey } from "@/lib/orders/identifiers";

/**
 * The oversell / concurrency test (TESTING_GUIDE.md §2 — the headline invariant).
 *
 * Scenario: a variant has exactly ONE unit left. Two (and ten) checkouts fire
 * simultaneously for it via Promise.all against the running transaction logic.
 * Exactly one must succeed; the others must get a clean OutOfStockError (not a
 * 500, not a partial). Final stock must be 0, with no negative drift.
 *
 * This proves the atomic decrement + SELECT...FOR UPDATE semantics hold under
 * real contention on Postgres/Supabase.
 */

let variantId: string;
let originalStock: number;
let originalReserved: number;

beforeAll(async () => {
  // Use a dedicated variant so concurrent test runs don't collide with others.
  const v = await prisma.variant.findFirst({
    where: { product: { slug: "wide-leg-trouser" }, colorway: "Ink", size: "XL" },
    select: { id: true, stock: true, reserved: true },
  });
  if (!v) throw new Error("seed variant missing");
  variantId = v.id;
  originalStock = v.stock;
  originalReserved = v.reserved;
});

afterAll(async () => {
  // Restore regardless of test outcome.
  await prisma.variant.update({
    where: { id: variantId },
    data: { stock: originalStock, reserved: originalReserved },
  });
  await prisma.$disconnect();
});

function validInput(idem: string): CheckoutInput {
  return {
    contact: { fullName: "Race Test", email: "race@example.com", phone: "01098765432" },
    delivery: { governorate: "Cairo", city: "Cairo", addressLine1: "1 Nile Street", postalCode: "", notes: "" },
    payment: { method: "COD" },
    idempotencyKey: idem,
  };
}

async function cartWithOne(token: string) {
  await prisma.cart.create({
    data: {
      cookieToken: token,
      expiresAt: new Date(Date.now() + 86_400_000),
      items: { create: [{ variantId, qty: 1 }] },
    },
  });
}

async function cleanupOrders(orders: { number: string }[]) {
  for (const o of orders) {
    const found = await prisma.order.findUnique({ where: { number: o.number }, select: { id: true } });
    if (found) {
      await prisma.orderItem.deleteMany({ where: { orderId: found.id } });
      await prisma.order.delete({ where: { id: found.id } });
    }
  }
}

describe("oversell protection — last-unit race", () => {
  it("with stock=1: exactly ONE of 2 simultaneous checkouts wins", async () => {
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1, reserved: 0 } });

    const tokens = [
      `race2a-${crypto.randomUUID()}`,
      `race2b-${crypto.randomUUID()}`,
    ];
    await Promise.all(tokens.map(cartWithOne));

    const results = await Promise.allSettled(
      tokens.map((t) => createOrder(t, validInput(generateIdempotencyKey()))),
    );

    const wins = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ number: string }>).value);
    const fails = results.filter((r) => r.status === "rejected");

    expect(wins.length).toBe(1);
    expect(fails.length).toBe(1);
    // losers get a clean OutOfStockError, not a 500
    const loser = (fails[0] as PromiseRejectedResult).reason;
    expect(loser).toBeInstanceOf(OutOfStockError);

    // stock ended at exactly 0 (not -1)
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    expect(after.stock).toBe(0);

    // cleanup
    await cleanupOrders(wins);
    await prisma.cart.deleteMany({ where: { cookieToken: { in: tokens } } });
  });

  it("with stock=1: exactly ONE of 10 simultaneous checkouts wins", async () => {
    await prisma.variant.update({ where: { id: variantId }, data: { stock: 1, reserved: 0 } });

    const tokens = Array.from({ length: 10 }, () => `race10-${crypto.randomUUID()}`);
    await Promise.all(tokens.map(cartWithOne));

    const results = await Promise.allSettled(
      tokens.map((t) => createOrder(t, validInput(generateIdempotencyKey()))),
    );

    const wins = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ number: string }>).value);
    const fails = results.filter((r) => r.status === "rejected");

    expect(wins.length).toBe(1);
    expect(fails.length).toBe(9);
    for (const f of fails) {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(OutOfStockError);
    }

    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    expect(after.stock).toBe(0);

    await cleanupOrders(wins);
    await prisma.cart.deleteMany({ where: { cookieToken: { in: tokens } } });
  });
});
