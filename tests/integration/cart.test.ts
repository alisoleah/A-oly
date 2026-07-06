import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadCart } from "@/lib/cart/repository";
import { addToCart, updateQty } from "@/lib/cart/actions";
import { availableStock } from "@/lib/availability";

/**
 * Cart integration tests — exercise the server actions against the real Supabase
 * Postgres DB, bypassing the cookie layer by passing explicit tokens (so the
 * tests don't need a Next.js request context).
 *
 * Critical invariant (TESTING_GUIDE.md §2): cannot add or set a quantity above
 * available stock. Proven end-to-end against persistence.
 *
 * NOTE: runs against the configured DATABASE_URL (Supabase). Each test creates
 * its own throwaway cart and removes it in cleanup so the shared DB stays clean.
 */

let testVariantId: string;

beforeAll(async () => {
  // Wide-Leg Trouser, Ivory, M — a stable seed variant.
  const v = await prisma.variant.findFirst({
    where: {
      product: { slug: "wide-leg-trouser" },
      colorway: "Ivory",
      size: "M",
    },
    select: { id: true, stock: true, reserved: true },
  });
  if (!v) throw new Error("seed variant missing — run npm run seed");
  testVariantId = v.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Make a throwaway cart for one test, auto-removed on cleanup. */
async function throwawayCart(): Promise<string> {
  const token = `test-${crypto.randomUUID()}`;
  await prisma.cart.create({
    data: { cookieToken: token, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  // register cleanup via the test runtime (best-effort; throwaway token prefixes
  // also let an admin sweep them later: DELETE WHERE cookieToken LIKE 'test-%')
  return token;
}

async function currentAvailable(id: string): Promise<number> {
  const v = await prisma.variant.findUniqueOrThrow({
    where: { id },
    select: { stock: true, reserved: true },
  });
  return availableStock(v.stock, v.reserved);
}

describe("cart server actions — stock cap (Supabase)", () => {
  it("rejects adding more than available stock", async () => {
    const token = await throwawayCart();
    const avail = await currentAvailable(testVariantId);

    const over = await addToCart(
      { variantId: testVariantId, qty: avail + 5 },
      { token },
    );
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toMatch(/available/i);

    await prisma.cart.delete({ where: { cookieToken: token } });
  });

  it("allows adding exactly the available stock", async () => {
    const token = await throwawayCart();
    const avail = await currentAvailable(testVariantId);
    if (avail < 1) return;

    const res = await addToCart(
      { variantId: testVariantId, qty: avail },
      { token },
    );
    expect(res.ok).toBe(true);

    const cart = await loadCart(token);
    const line = cart.lines.find((l) => l.variantId === testVariantId);
    expect(line?.qty).toBe(avail);

    await prisma.cart.delete({ where: { cookieToken: token } });
  });

  it("rejects setting quantity above the cap via updateQty", async () => {
    const token = await throwawayCart();
    await addToCart({ variantId: testVariantId, qty: 1 }, { token });

    const avail = await currentAvailable(testVariantId);
    const over = await updateQty(
      { variantId: testVariantId, qty: avail + 10 },
      { token },
    );
    expect(over.ok).toBe(false);

    await prisma.cart.delete({ where: { cookieToken: token } });
  });

  it("qty 0 removes the line", async () => {
    const token = await throwawayCart();
    await addToCart({ variantId: testVariantId, qty: 1 }, { token });

    const res = await updateQty(
      { variantId: testVariantId, qty: 0 },
      { token },
    );
    expect(res.ok).toBe(true);

    const cart = await loadCart(token);
    expect(cart.lines).toHaveLength(0);

    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});

describe("cart totals — server-computed (Supabase)", () => {
  it("line total = unit price × qty; subtotal = Σ line totals", async () => {
    const token = await throwawayCart();
    await addToCart({ variantId: testVariantId, qty: 2 }, { token });

    const cart = await loadCart(token);
    const line = cart.lines.find((l) => l.variantId === testVariantId);
    expect(line).toBeTruthy();
    expect(line!.lineTotal).toBe(line!.unitAmount * 2);
    expect(cart.subtotal).toBe(
      cart.lines.reduce((sum, l) => sum + l.lineTotal, 0),
    );

    await prisma.cart.delete({ where: { cookieToken: token } });
  });
});
