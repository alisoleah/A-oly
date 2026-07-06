import { OrderStatus } from "@prisma/client";
export type { OrderStatus } from "@prisma/client";

/**
 * Order state machine — the single authority on status transitions.
 *
 * INVARIANT (CLAUDE.md, TESTING_GUIDE.md §4): only a webhook transitions
 * PENDING_PAYMENT → PAID. The client redirect NEVER sets status. COD orders
 * are created as PENDING_COD and marked PAID by the admin on collection.
 *
 * Illegal transitions throw and mutate nothing. Every (fromStatus, event)
 * pair is exercised by a table-driven unit test.
 */

/** Discrete events that drive transitions. */
export type OrderEvent =
  | "online_payment_succeeded" // webhook only (Phase 4)
  | "cod_placed" // COD order created
  | "admin_mark_paid" // COD collected → admin marks paid
  | "start_fulfilling"
  | "ship"
  | "deliver"
  | "cancel" // failed payment / abandoned / admin cancel
  | "refund";

/**
 * Legal transitions as an adjacency map.
 * Anything not listed here is illegal and throws.
 */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  PENDING_PAYMENT: {
    online_payment_succeeded: "PAID",
    cancel: "CANCELLED", // abandoned/failed online payment → release stock
  },
  PENDING_COD: {
    admin_mark_paid: "PAID",
    cancel: "CANCELLED",
  },
  PAID: {
    start_fulfilling: "FULFILLING",
    refund: "REFUNDED",
    cancel: "CANCELLED", // allow immediate cancel of a just-paid order
  },
  FULFILLING: {
    ship: "SHIPPED",
    cancel: "CANCELLED",
  },
  SHIPPED: {
    deliver: "DELIVERED",
  },
  DELIVERED: {
    refund: "REFUNDED",
  },
  CANCELLED: {}, // terminal
  REFUNDED: {}, // terminal
};

export class IllegalTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly event: OrderEvent,
  ) {
    super(`Illegal order transition: ${from} --${event}-->`);
    this.name = "IllegalTransitionError";
  }
}

/**
 * Compute the next status for an event, or throw if the transition is illegal.
 * Pure function — does not touch the DB. The caller persists the result inside
 * the appropriate transaction.
 */
export function nextStatus(from: OrderStatus, event: OrderEvent): OrderStatus {
  const target = TRANSITIONS[from]?.[event];
  if (!target) {
    throw new IllegalTransitionError(from, event);
  }
  return target;
}

/** True if the transition is legal (does not throw). */
export function canTransition(from: OrderStatus, event: OrderEvent): boolean {
  try {
    nextStatus(from, event);
    return true;
  } catch {
    return false;
  }
}

/** Whether a status is terminal (no outgoing transitions). */
export function isTerminal(status: OrderStatus): boolean {
  return Object.keys(TRANSITIONS[status] ?? {}).length === 0;
}
