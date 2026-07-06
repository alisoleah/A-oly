"use server";

import { prisma } from "@/lib/prisma";
import { ensureCartToken } from "@/lib/cart/repository";
import { availableStock, maxAddableQty } from "@/lib/availability";
import { z } from "zod";

/**
 * Cart server actions — every mutation goes through here and is validated.
 *
 * Stock caps are enforced SERVER-SIDE on every write (CLAUDE.md non-negotiable):
 * a client can never set a quantity above what's available (stock − reserved).
 * Direct API attempts beyond stock return a clean error, never a 500.
 *
 * Result shapes are plain objects (not thrown) so client components can render
 * friendly messages. Success/failure is in `ok`.
 */

export type CartActionResult =
  | { ok: true; itemCount: number }
  | { ok: false; error: string };

// ── Add to cart ──────────────────────────────────────────────

const addSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().positive().max(99).default(1),
});

export async function addToCart(
  input: z.infer<typeof addSchema>,
  opts?: { token?: string },
): Promise<CartActionResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return err("Invalid request.");

  const { variantId, qty } = parsed.data;
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { id: true, stock: true, reserved: true },
  });
  if (!variant) return err("This item is no longer available.");

  const token = opts?.token ?? (await ensureCartToken());
  const cart = await prisma.cart.findUniqueOrThrow({
    where: { cookieToken: token },
    select: { id: true, items: { where: { variantId }, select: { id: true, qty: true } } },
  });

  const already = cart.items[0]?.qty ?? 0;
  const cap = maxAddableQty(variant.stock, variant.reserved);
  const desired = already + qty;
  if (desired > cap) {
    return err(
      cap === 0
        ? "Sorry, this just sold out."
        : `Only ${cap} available${already > 0 ? ` (you already have ${already} in your bag)` : ""}.`,
    );
  }

  // upsert the line
  if (cart.items[0]) {
    await prisma.cartItem.update({
      where: { id: cart.items[0].id },
      data: { qty: desired },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, variantId, qty: desired },
    });
  }

  return ok(await itemCount(token));
}

// ── Update quantity ──────────────────────────────────────────

const updateSchema = z.object({
  variantId: z.string().min(1),
  qty: z.number().int().min(0).max(99),
});

export async function updateQty(
  input: z.infer<typeof updateSchema>,
  opts?: { token?: string },
): Promise<CartActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return err("Invalid request.");

  const { variantId, qty } = parsed.data;
  const token = opts?.token ?? (await ensureCartToken());

  const line = await prisma.cartItem.findFirst({
    where: { cart: { cookieToken: token }, variantId },
    include: { variant: { select: { stock: true, reserved: true } } },
  });
  if (!line) return err("Item not in your bag.");

  // qty 0 removes the line.
  if (qty === 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
    return ok(await itemCount(token));
  }

  const cap = maxAddableQty(line.variant.stock, line.variant.reserved);
  if (qty > cap) {
    return err(
      cap === 0 ? "This just sold out." : `Only ${cap} available.`,
    );
  }

  await prisma.cartItem.update({ where: { id: line.id }, data: { qty } });
  return ok(await itemCount(token));
}

// ── Remove a line ────────────────────────────────────────────

const removeSchema = z.object({ variantId: z.string().min(1) });

export async function removeFromCart(
  input: z.infer<typeof removeSchema>,
  opts?: { token?: string },
): Promise<CartActionResult> {
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return err("Invalid request.");

  const { variantId } = parsed.data;
  const token = opts?.token ?? (await ensureCartToken());

  await prisma.cartItem.deleteMany({
    where: { cart: { cookieToken: token }, variantId },
  });
  return ok(await itemCount(token));
}

// ── helpers ──────────────────────────────────────────────────

async function itemCount(token: string): Promise<number> {
  const rows = await prisma.cartItem.aggregate({
    where: { cart: { cookieToken: token } },
    _sum: { qty: true },
  });
  return rows._sum.qty ?? 0;
}

function ok(itemCount: number): CartActionResult {
  return { ok: true, itemCount };
}
function err(error: string): CartActionResult {
  return { ok: false, error };
}

// Re-export for components that need the availability read directly
export { availableStock };
