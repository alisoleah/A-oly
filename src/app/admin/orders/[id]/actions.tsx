"use client";

import { useState } from "react";
import { markOrderPaid, markOrderShipped, startFulfilling } from "@/lib/admin/actions";
import { Button } from "@/components/ui/Button";

/**
 * Order action panel — shows the transitions legal for the current status.
 * Uses the server actions, which go through the state machine (illegal moves
 * are rejected server-side).
 */
export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [tracking, setTracking] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, label: string) {
    setMsg(`${label}…`);
    const r = await fn();
    setMsg(r.ok ? `${label} ✓` : r.error ?? "Failed");
    if (r.ok) window.location.reload();
  }

  return (
    <div className="border border-line p-4">
      <h2 className="text-meta mb-3">Actions</h2>
      <div className="space-y-3">
        {status === "PENDING_COD" && (
          <Button variant="primary" className="w-full" onClick={() => run(() => markOrderPaid(orderId), "Marking paid")}>
            Mark paid (COD collected)
          </Button>
        )}
        {status === "PAID" && (
          <Button variant="primary" className="w-full" onClick={() => run(() => startFulfilling(orderId), "Starting fulfilment")}>
            Start fulfilment
          </Button>
        )}
        {status === "FULFILLING" && (
          <>
            <input
              type="text"
              placeholder="Tracking number"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              className="h-10 w-full border border-line px-3 text-sm"
            />
            <Button
              variant="primary"
              className="w-full"
              disabled={!tracking}
              onClick={() => run(() => markOrderShipped({ orderId, trackingNumber: tracking }), "Marking shipped")}
            >
              Mark shipped
            </Button>
          </>
        )}
        {["SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(status) && (
          <p className="text-xs text-ink-soft">No further actions for this status.</p>
        )}
      </div>
      {msg && <p className="mt-3 text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
