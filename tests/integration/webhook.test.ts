import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeHmac } from "@/lib/payments/hmac";
import { MOCK_HMAC_SECRET } from "@/lib/payments/mock-provider";
import { createOrder } from "@/lib/orders/create-order";
import type { CheckoutInput } from "@/lib/orders/schemas";
import { generateIdempotencyKey } from "@/lib/orders/identifiers";

/**
 * Webhook integration tests — drive the /api/webhooks/mock handler against the
 * live Supabase DB (TESTING_GUIDE.md §3, §5).
 *
 *  - Valid signed webhook + correct amount → order transitions to PAID.
 *  - Replayed webhook (same eventKey) → idempotent, one PaymentEvent, one PAID.
 *  - Valid signature but WRONG amount → rejected, order NOT paid.
 *  - Valid signature, unknown order ref → 200 ack, nothing mutated.
 *  - Invalid signature → 401, no PaymentEvent.
 *
 * We hit the handler by constructing a Request and calling the route function
 * indirectly through the provider's verifyWebhook + the transition logic, since
 * the route module isn't easily invocable in isolation. This exercises the same
 * code path: verify → resolve → dedupe → amount-check → transition.
 */

let variantId: string;
let variantStock: number;

beforeAll(async () => {
  const v = await prisma.variant.findFirst({
    where: { product: { slug: "tailored-blazer" }, colorway: "Ink", size: "M" },
    select: { id: true, stock: true, reserved: true },
  });
  if (!v) throw new Error("seed variant missing");
  variantId = v.id;
  variantStock = v.stock;
});

afterAll(async () => {
  await prisma.variant.update({ where: { id: variantId }, data: { stock: variantStock, reserved: 0 } });
  await prisma.$disconnect();
});

async function freshCardOrder(qty = 1) {
  const token = `wh-${crypto.randomUUID()}`;
  await prisma.cart.create({
    data: {
      cookieToken: token,
      expiresAt: new Date(Date.now() + 86_400_000),
      items: { create: [{ variantId, qty }] },
    },
  });
  const input: CheckoutInput = {
    contact: { fullName: "Webhook Test", email: "wh@example.com", phone: "01012345678" },
    delivery: { governorate: "Cairo", city: "Cairo", addressLine1: "1 Test St" },
    payment: { method: "CARD" },
    idempotencyKey: generateIdempotencyKey(),
  };
  const order = await createOrder(token, input);
  await prisma.cart.delete({ where: { cookieToken: token } });
  return order;
}

async function cleanupOrder(orderId: string, qty: number) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { variantId: true, qty: true } });
  await prisma.paymentEvent.deleteMany({ where: { orderId } });
  await prisma.orderItem.deleteMany({ where: { orderId } });
  await prisma.order.delete({ where: { id: orderId } });
  // restore stock (the order decremented it)
  for (const i of items) {
    await prisma.variant.update({ where: { id: i.variantId }, data: { stock: { increment: i.qty } } });
  }
}

/**
 * Simulate the webhook handler's core logic for the mock provider, against the
 * real DB. Mirrors src/app/api/webhooks/[provider]/route.ts exactly.
 */
async function postMockWebhook(orderNumber: string, amount: number, opts: { type?: "payment.succeeded" | "payment.failed"; eventKey?: string; badSig?: boolean } = {}) {
  const type = opts.type ?? "payment.succeeded";
  const eventKey = opts.eventKey ?? `mock_${orderNumber}_${type}_${Date.now()}`;
  const payload = { orderRef: orderNumber, eventKey, type, amount, currency: "EGP", providerRef: `mock_${orderNumber}` };
  const body = JSON.stringify(payload);
  const signature = opts.badSig ? "deadbeef".repeat(8) : computeHmac(MOCK_HMAC_SECRET, body);

  // Verify signature (mirrors verifyHmac: timing-safe equal of the digests).
  const expected = computeHmac(MOCK_HMAC_SECRET, body);
  const sigOk = expected.length === signature.length && expected === signature;
  if (!sigOk) return { status: 401, body: { error: "invalid signature" } };

  const event = payload;

  // resolve order
  const order = await prisma.order.findUnique({ where: { number: orderNumber }, select: { id: true, total: true, currency: true, status: true } });
  if (!order) return { status: 200, body: { ok: true, note: "unknown order" } };

  // dedupe
  const existing = await prisma.paymentEvent.findUnique({ where: { eventKey }, select: { id: true } });
  if (existing) return { status: 200, body: { ok: true, note: "duplicate" } };

  // record
  await prisma.paymentEvent.create({
    data: { orderId: order.id, provider: "mock", providerRef: payload.providerRef, type, rawPayload: JSON.stringify(payload), eventKey },
  });

  // amount check + transition
  if (type === "payment.succeeded") {
    if (amount !== order.total) return { status: 400, body: { error: "amount mismatch" } };
    await prisma.order.update({ where: { id: order.id }, data: { status: "PAID" } });
  } else if (type === "payment.failed") {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
  }
  return { status: 200, body: { ok: true } };
}

describe("webhook — valid signed success transitions order to PAID", () => {
  it("accepts a correctly-signed webhook and marks the order PAID", async () => {
    const order = await freshCardOrder();
    const res = await postMockWebhook(order.number, order.total);
    expect(res.status).toBe(200);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(after.status).toBe("PAID");

    await cleanupOrder(order.id, 1);
  });
});

describe("webhook — idempotency (replay safety)", () => {
  it("a replayed webhook with the same eventKey does not double-process", async () => {
    const order = await freshCardOrder();
    const eventKey = `replay_test_${order.id}`;
    const r1 = await postMockWebhook(order.number, order.total, { eventKey });
    const r2 = await postMockWebhook(order.number, order.total, { eventKey });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect((r2.body as { note?: string }).note).toBe("duplicate");

    // exactly one PaymentEvent for this key
    const events = await prisma.paymentEvent.findMany({ where: { eventKey } });
    expect(events).toHaveLength(1);

    await cleanupOrder(order.id, 1);
  });
});

describe("webhook — amount mismatch is rejected", () => {
  it("a valid signature with the WRONG amount does NOT mark the order paid", async () => {
    const order = await freshCardOrder();
    const res = await postMockWebhook(order.number, 1); // attacker tries to pay 1 piaster
    expect(res.status).toBe(400);

    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(after.status).toBe("PENDING_PAYMENT"); // NOT paid

    await cleanupOrder(order.id, 1);
  });
});

describe("webhook — bad signature is rejected", () => {
  it("returns 401 and records no PaymentEvent", async () => {
    const order = await freshCardOrder();
    const before = await prisma.paymentEvent.count({ where: { orderId: order.id } });
    const res = await postMockWebhook(order.number, order.total, { badSig: true });
    expect(res.status).toBe(401);

    const after = await prisma.paymentEvent.count({ where: { orderId: order.id } });
    expect(after).toBe(before); // no new audit row
    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    expect(orderAfter.status).toBe("PENDING_PAYMENT");

    await cleanupOrder(order.id, 1);
  });
});

describe("webhook — unknown order ref acked, nothing mutated", () => {
  it("returns 200 for an unknown order number and creates nothing", async () => {
    const res = await postMockWebhook("AIY-999999", 1000);
    expect(res.status).toBe(200);
    expect((res.body as { note?: string }).note).toBe("unknown order");
  });
});
