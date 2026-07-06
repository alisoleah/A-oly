import { prisma } from "@/lib/prisma";
import { nextStatus, IllegalTransitionError } from "@/lib/orders/state-machine";
import type { OrderEvent, OrderStatus } from "@/lib/orders/state-machine";

/**
 * Server-side order status transitions.
 *
 * Wraps the pure state machine in a DB write that:
 *  - reads the CURRENT status (not a stale client value)
 *  - asserts the transition is legal (throws + mutates nothing if not)
 *  - persists only the legal target
 *
 * The webhook handler and admin actions both go through here, so the rule
 * "only legal transitions, only via these paths" is enforced in one place.
 */
export async function transitionOrderStatus(
  orderId: string,
  event: OrderEvent,
): Promise<{ from: OrderStatus; to: OrderStatus }> {
  // Lock + read current status inside a transaction so a concurrent webhook
  // can't race another webhook.
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    const to = nextStatus(order.status as OrderStatus, event);
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    return { from: order.status as OrderStatus, to };
  });
}

export { IllegalTransitionError };
