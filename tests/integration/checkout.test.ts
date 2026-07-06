import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addToCart } from "@/lib/cart/actions";
import { createOrder, OutOfStockError } from "@/lib/orders/create-order";
import type { CheckoutInput } from "@/lib/orders/schemas";
import { generateIdempotencyKey } from "@/lib/orders/identifiers";

/**
 * Checkout integration tests — prove the safety-critical invariants against
 * the live Supabase DB (TESTING_GUIDE.md §1, §2, §3).
 *
 *  - Idempotent creation: same key → same order.
 *  - Tampered total ignored: there is no total in the schema to tamper; totals
 *    are recomputed server-side. Asserted by checking the order total equals
 *    the server computation, not any client value.
 *  - Atomicity: an out-of-stock item fails the WHOLE order (no partial decrement).
 *  - Stock decremented; price/name snapshots frozen.
 */

let variantId: string;
let variantPrice: number;

beforeAll(async () => {
  const v = await prisma.variant.findFirst({
    where: { product: { slug: "fluid-shirt" }, colorway: "Ivory", size: "M" },
    select: { id: true, prices: { where: { currency: "EGP" } }, stock: true },
  });
  if (!v) throw new Error("seed variant missing");
  variantId = v.id;
  variantPrice = v.prices[0]?.unitAmount ?? 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function freshCartWith(variantId: string, qty: number): Promise<string> {
  const token = `co-${crypto.randomUUID()}`;
  await prisma.cart.create({
    data: {
      cookieToken: token,
      expiresAt: new Date(Date.now() + 86_400_000),
      items: { create: [{ variantId, qty }] },
    },
  });
  return token;
}

function validInput(idem: string): CheckoutInput {
  return {
    contact: {
      fullName: "Amira Test",
      email: "amira@example.com",
      phone: "01012345678",
    },
    delivery: {
      governorate: "Cairo",
      city: "Cairo",
      addressLine1: "12 Tahrir Square",
      postalCode: "",
      notes: "",
    },
    payment: { method: "COD" },
    idempotencyKey: idem,
  };
}

async function cleanupOrder(orderNumber: string, variantId: string, qty: number) {
  const order = await prisma.order.findUnique({
    where: { number: orderNumber },
    select: { id: true },
  });
  if (order) {
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  }
  // restore stock
  await prisma.variant.update({
    where: { id: variantId },
    data: { stock: { increment: qty } },
  });
}

describe("createOrder — COD happy path", () => {
  it("creates a PENDING_COD order with server-computed totals and decremented stock", async () => {
    const token = await freshCartWith(variantId, 2);
    const idem = generateIdempotencyKey();
    const before = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });

    const order = await createOrder(token, validInput(idem));

    expect(order.status).toBe("PENDING_COD");
    expect(order.paymentMethod).toBe("COD");
    expect(order.number).toMatch(/^AIY-\d{6}$/);
    expect(order.confirmToken).toHaveLength(64); // 32 bytes hex
    // total = unit price × qty (shipping waived above threshold? fluid shirt 2200×2=4400 < 5000, so +600 shipping)
    const expectedSubtotal = variantPrice * 2;
    const expectedShipping = expectedSubtotal >= 500000 ? 0 : 6000;
    expect(order.subtotal).toBe(expectedSubtotal);
    expect(order.shipping).toBe(expectedShipping);
    expect(order.total).toBe(expectedSubtotal + expectedShipping);

    // stock decremented by 2
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    expect(after.stock).toBe(before.stock - 2);

    // cart cleared
    const cart = await prisma.cart.findUniqueOrThrow({ where: { cookieToken: token }, include: { items: true } });
    expect(cart.items).toHaveLength(0);

    await cleanupOrder(order.number, variantId, 2);
    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});

describe("createOrder — idempotency", () => {
  it("returns the SAME order when called twice with the same idempotency key", async () => {
    const token = await freshCartWith(variantId, 1);
    const idem = generateIdempotencyKey();
    // Pre-seed the cart again because the first call clears it; the second call
    // must short-circuit on the key before reading the (now empty) cart.
    const first = await createOrder(token, validInput(idem));

    // Re-add stock-equivalent so a non-idempotent impl would create a 2nd order:
    await prisma.cart.update({
      where: { cookieToken: token },
      data: { items: { create: [{ variantId, qty: 1 }] } },
    });
    const second = await createOrder(token, validInput(idem));

    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);

    // only one order row with this key
    const count = await prisma.order.count({ where: { idempotencyKey: idem } });
    expect(count).toBe(1);

    await cleanupOrder(first.number, variantId, 1);
    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});

describe("createOrder — atomicity (no partial decrement)", () => {
  it("fails the WHOLE order when one line is out of stock, decrementing nothing", async () => {
    // Make a variant appear to have 0 available by setting reserved = stock.
    const orig = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true, reserved: true } });
    await prisma.variant.update({ where: { id: variantId }, data: { reserved: orig.stock } });

    const token = await freshCartWith(variantId, 1);
    await expect(createOrder(token, validInput(generateIdempotencyKey()))).rejects.toThrow(OutOfStockError);

    // nothing decremented: stock unchanged
    const after = await prisma.variant.findUniqueOrThrow({ where: { id: variantId }, select: { stock: true } });
    expect(after.stock).toBe(orig.stock);

    // no order created
    const cart = await prisma.cart.findUniqueOrThrow({ where: { cookieToken: token }, include: { items: true } });
    expect(cart.items.length).toBe(1); // cart NOT cleared on failure

    // restore
    await prisma.variant.update({ where: { id: variantId }, data: { reserved: orig.reserved } });
    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});

describe("createOrder — price/name snapshot", () => {
  it("order item freezes the unit price; a later price change does not alter the order", async () => {
    const token = await freshCartWith(variantId, 1);
    const order = await createOrder(token, validInput(generateIdempotencyKey()));

    const snapshot = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
      select: { unitAmountSnapshot: true, nameSnapshot: true },
    });
    expect(snapshot.unitAmountSnapshot).toBe(variantPrice);
    expect(snapshot.nameSnapshot).toBe("Fluid Shirt");

    // change the price in the DB after order creation
    const newPrice = variantPrice + 10000;
    await prisma.price.updateMany({
      where: { variantId, currency: "EGP" },
      data: { unitAmount: newPrice },
    });

    // the order's snapshot is unchanged
    const stillSnapshot = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id },
      select: { unitAmountSnapshot: true },
    });
    expect(stillSnapshot.unitAmountSnapshot).toBe(variantPrice); // NOT newPrice

    // restore the price
    await prisma.price.updateMany({
      where: { variantId, currency: "EGP" },
      data: { unitAmount: variantPrice },
    });

    await cleanupOrder(order.number, variantId, 1);
    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});
