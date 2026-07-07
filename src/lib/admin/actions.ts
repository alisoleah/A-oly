"use server";

import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertPiasters } from "@/lib/money";
import { transitionOrderStatus, IllegalTransitionError } from "@/lib/orders/transitions";
import { sendOrderConfirmation } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Admin server actions — every mutation goes through here, behind the
 * middleware auth gate. Zod-validated; uses the order state machine for status
 * transitions so illegal moves throw and change nothing.
 */

// ── Product / variant edits ──────────────────────────────────

const stockSchema = z.object({
  variantId: z.string().min(1),
  stock: z.number().int().min(0).max(9999),
});
export async function updateStock(input: z.infer<typeof stockSchema>) {
  const parsed = stockSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid stock value." };
  await prisma.variant.update({
    where: { id: parsed.data.variantId },
    data: { stock: parsed.data.stock },
  });
  return { ok: true };
}

const priceSchema = z.object({
  variantId: z.string().min(1),
  unitAmount: z.number().int().min(0), // integer piasters
});
export async function updatePrice(input: z.infer<typeof priceSchema>) {
  const parsed = priceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid price." };
  assertPiasters(parsed.data.unitAmount, "price");
  await prisma.price.upsert({
    where: { variantId_currency: { variantId: parsed.data.variantId, currency: "EGP" } },
    update: { unitAmount: parsed.data.unitAmount },
    create: { variantId: parsed.data.variantId, currency: "EGP", unitAmount: parsed.data.unitAmount },
  });
  return { ok: true };
}

const publishSchema = z.object({ productId: z.string().min(1), published: z.boolean() });
export async function togglePublish(input: z.infer<typeof publishSchema>) {
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await prisma.product.update({
    where: { id: parsed.data.productId },
    data: { published: parsed.data.published },
  });
  return { ok: true };
}

// ── Order transitions ────────────────────────────────────────

/** Mark a COD order paid (collected by courier). Legal: PENDING_COD → PAID. */
export async function markOrderPaid(orderId: string) {
  try {
    await transitionOrderStatus(orderId, "admin_mark_paid");
    return { ok: true };
  } catch (e) {
    if (e instanceof IllegalTransitionError) {
      return { ok: false, error: `Cannot mark paid from ${e.from}.` };
    }
    throw e;
  }
}

const shipSchema = z.object({ orderId: z.string().min(1), trackingNumber: z.string().min(1).max(80) });
/**
 * Mark an order shipped (legal: FULFILLING → SHIPPED, or PAID → start_fulfilling
 * then ship). Sends the shipping notification email.
 */
export async function markOrderShipped(input: z.infer<typeof shipSchema>) {
  const parsed = shipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid tracking number." };

  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: parsed.data.orderId },
      select: { id: true, status: true, number: true, email: true, total: true },
    });

    // If PAID, start fulfilling first (then ship).
    if (order.status === "PAID") {
      await transitionOrderStatus(order.id, "start_fulfilling");
    }
    await transitionOrderStatus(order.id, "ship");
    await prisma.order.update({
      where: { id: order.id },
      data: { trackingNumber: parsed.data.trackingNumber, shippingCarrier: "Courier" },
    });

    // Shipping email (non-blocking).
    void sendOrderConfirmation({
      orderNumber: order.number,
      email: order.email,
      fullName: order.email.split("@")[0] ?? "Customer",
      total: order.total,
      isCod: false,
      confirmUrl: `${env.APP_BASE_URL.replace(/\/$/, "")}/orders/${order.id}`,
      items: [],
    }).catch(() => {});

    return { ok: true };
  } catch (e) {
    if (e instanceof IllegalTransitionError) {
      return { ok: false, error: `Cannot ship from ${e.from}.` };
    }
    throw e;
  }
}

/** Start fulfilment (legal: PAID → FULFILLING). */
export async function startFulfilling(orderId: string) {
  try {
    await transitionOrderStatus(orderId, "start_fulfilling");
    return { ok: true };
  } catch (e) {
    if (e instanceof IllegalTransitionError) {
      return { ok: false, error: `Cannot fulfil from ${e.from}.` };
    }
    throw e;
  }
}
