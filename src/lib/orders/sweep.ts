import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Reservation TTL sweep — releases stock held by abandoned online payments.
 *
 * A PENDING_PAYMENT order decremented stock at creation (Phase 3). If the
 * customer never completes payment, that stock is held forever unless swept.
 * This finds PENDING_PAYMENT orders older than RESERVATION_TTL_MINUTES,
 * restocks their items, and cancels them.
 *
 * INVARIANT (TESTING_GUIDE.md §2): the sweep is idempotent — running it twice
 * never restocks twice (the order is no longer PENDING_PAYMENT after the first).
 */
export async function sweepAbandonedPayments(): Promise<{ cancelled: number; itemsRestocked: number }> {
  const cutoff = new Date(Date.now() - env.RESERVATION_TTL_MINUTES * 60 * 1000);

  const stale = await prisma.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: cutoff },
    },
    select: { id: true, items: { select: { variantId: true, qty: true } } },
  });

  let itemsRestocked = 0;
  for (const order of stale) {
    // Restock each line, then cancel. Idempotent: a second run finds the order
    // no longer PENDING_PAYMENT, so it skips it (no double-restock).
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        order.items.map((item) =>
          tx.variant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.qty } },
          }),
        ),
      );
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    });
    itemsRestocked += order.items.reduce((n, i) => n + i.qty, 0);
  }

  return { cancelled: stale.length, itemsRestocked };
}
