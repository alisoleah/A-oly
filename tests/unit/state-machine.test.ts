import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  canTransition,
  IllegalTransitionError,
  isTerminal,
  nextStatus,
  type OrderEvent,
} from "@/lib/orders/state-machine";

/**
 * State machine tests — table-driven over EVERY (fromStatus, event) pair
 * (TESTING_GUIDE.md §4). Legal transitions succeed; illegal ones throw and
 * would change nothing. The headline rule: only `online_payment_succeeded`
 * moves PENDING_PAYMENT → PAID; the client redirect can never set status.
 */

const ALL_STATUSES = Object.values(OrderStatus);
const ALL_EVENTS: OrderEvent[] = [
  "online_payment_succeeded",
  "cod_placed",
  "admin_mark_paid",
  "start_fulfilling",
  "ship",
  "deliver",
  "cancel",
  "refund",
];

// The legal transitions — every other (status, event) pair must be illegal.
const LEGAL: Record<string, OrderStatus> = {
  "PENDING_PAYMENT:online_payment_succeeded": "PAID",
  "PENDING_PAYMENT:cancel": "CANCELLED",
  "PENDING_COD:admin_mark_paid": "PAID",
  "PENDING_COD:cancel": "CANCELLED",
  "PAID:start_fulfilling": "FULFILLING",
  "PAID:refund": "REFUNDED",
  "PAID:cancel": "CANCELLED",
  "FULFILLING:ship": "SHIPPED",
  "FULFILLING:cancel": "CANCELLED",
  "SHIPPED:deliver": "DELIVERED",
  "DELIVERED:refund": "REFUNDED",
};

describe("order state machine — legal transitions", () => {
  for (const [key, expected] of Object.entries(LEGAL)) {
    const [from, event] = key.split(":") as [OrderStatus, OrderEvent];
    it(`${from} --${event}--> ${expected}`, () => {
      expect(nextStatus(from, event)).toBe(expected);
      expect(canTransition(from, event)).toBe(true);
    });
  }
});

describe("order state machine — illegal transitions throw", () => {
  for (const status of ALL_STATUSES) {
    for (const event of ALL_EVENTS) {
      const key = `${status}:${event}`;
      if (key in LEGAL) continue;
      it(`${status} --${event}--> throws`, () => {
        expect(() => nextStatus(status, event)).toThrow(IllegalTransitionError);
        expect(canTransition(status, event)).toBe(false);
      });
    }
  }
});

describe("order state machine — invariants", () => {
  it("PENDING_PAYMENT can ONLY reach PAID via the webhook event", () => {
    // The headline rule: no other event, no client redirect, sets PAID.
    for (const event of ALL_EVENTS) {
      if (event === "online_payment_succeeded") {
        expect(nextStatus("PENDING_PAYMENT", event)).toBe("PAID");
      } else if (event === "cancel") {
        expect(nextStatus("PENDING_PAYMENT", event)).toBe("CANCELLED");
      } else {
        expect(() => nextStatus("PENDING_PAYMENT", event)).toThrow();
      }
    }
  });

  it("a DELIVERED order cannot be re-paid or un-delivered", () => {
    // No backwards transitions out of DELIVERED except refund.
    expect(() => nextStatus("DELIVERED", "online_payment_succeeded")).toThrow();
    expect(() => nextStatus("DELIVERED", "start_fulfilling")).toThrow();
    expect(() => nextStatus("DELIVERED", "ship")).toThrow();
    expect(nextStatus("DELIVERED", "refund")).toBe("REFUNDED");
  });

  it("a webhook success on a CANCELLED order is rejected", () => {
    // Replayed/late webhook must not resurrect a cancelled order.
    expect(() => nextStatus("CANCELLED", "online_payment_succeeded")).toThrow();
  });

  it("CANCELLED and REFUNDED are terminal", () => {
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("REFUNDED")).toBe(true);
  });

  it("non-terminal statuses have at least one outgoing transition", () => {
    for (const s of ALL_STATUSES) {
      if (s === "CANCELLED" || s === "REFUNDED") continue;
      expect(isTerminal(s)).toBe(false);
    }
  });
});
