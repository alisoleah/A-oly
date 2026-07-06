"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Client half of the mock pay page. Renders the succeed/fail buttons and posts
 * the signed fake webhook, then redirects to the "confirming payment" page that
 * polls until the webhook flips the order to PAID.
 *
 * The signing happens server-side (we can't expose the HMAC secret to the
 * browser), so the buttons call /api/mock-pay/sign to get a signed payload,
 * then forward it to the webhook.
 */
export function MockPayClient({ ref_ }: { ref_: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Extract the order number from the mock ref (mock_<orderId>) — we need it to
  // look up the real order + amount. We fetch it via a tiny endpoint.
  async function resolveOrder() {
    const res = await fetch(`/api/mock-pay/resolve?ref=${encodeURIComponent(ref_)}`);
    if (!res.ok) throw new Error("Could not resolve order");
    return (await res.json()) as { orderNumber: string; amount: number; confirmToken: string };
  }

  async function pay(outcome: "succeeded" | "failed") {
    setBusy(true);
    setErr(null);
    try {
      const order = await resolveOrder();
      // Ask the server to sign a fake webhook payload (secret stays server-side).
      const eventKey = `mock_${ref_}_${outcome}_${Date.now()}`;
      const payload = {
        orderRef: order.orderNumber,
        eventKey,
        type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
        amount: order.amount,
        currency: "EGP",
        providerRef: ref_,
      };
      const signRes = await fetch("/api/mock-pay/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { signature } = await signRes.json();

      // POST the signed webhook to our own endpoint.
      await fetch("/api/webhooks/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mock-signature": signature },
        body: JSON.stringify(payload),
      });

      // Go to the confirming page — it polls until the order is PAID (or failed).
      router.push(`/checkout/confirming/${order.confirmToken}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button variant="gold" onClick={() => pay("succeeded")} disabled={busy} className="flex-1">
          {busy ? "Processing…" : "Pay (succeed)"}
        </Button>
        <Button variant="ghost" onClick={() => pay("failed")} disabled={busy}>
          Fail
        </Button>
      </div>
      {err && <p className="text-sm text-error">{err}</p>}
    </div>
  );
}
