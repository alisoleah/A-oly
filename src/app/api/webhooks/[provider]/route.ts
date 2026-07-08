import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/factory";
import { transitionOrderStatus, IllegalTransitionError } from "@/lib/orders/transitions";
import { assertPiasters } from "@/lib/money";
import { maskPayload } from "@/lib/payments/mask";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * The webhook endpoint — the ONLY thing that transitions an order to PAID.
 *
 * Flow (security audit area A — highest priority):
 *  1. The provider's verifyWebhook confirms the signature (timing-safe) or throws.
 *     A bad signature → 401, no PaymentEvent row, nothing mutated.
 *  2. Resolve the order by the provider's reference (order number).
 *  3. Dedupe on PaymentEvent.eventKey (UNIQUE) — a replayed webhook is a no-op.
 *  4. For payment.succeeded: compare the provider's amount against the order
 *     total; reject + flag if they differ. Only then transition to PAID.
 *  5. Unknown order refs: ack (200) + log, but mutate nothing.
 *
 * Returns 200 on healthy ack (so the provider stops retrying) even for benign
 * no-ops; 401 only on signature failure (so the provider knows we rejected it).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerName } = await params;
  const provider = getPaymentProvider();

  if (provider.name !== providerName) {
    // Route/provider mismatch — don't process under the wrong verifier.
    return NextResponse.json({ error: "provider mismatch" }, { status: 404 });
  }

  // Rate limit webhook intake: 60/min per IP (providers retry, so generous).
  const ip = clientIp(request);
  const limit = rateLimit("webhook", ip, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // 1. Verify signature (throws on mismatch).
  let event;
  try {
    event = await provider.verifyWebhook(request);
  } catch (e) {
    console.warn(`[webhook:${providerName}] signature verification failed:`, (e as Error).message);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2. Resolve the order. For the mock, orderRef is the order number.
  const order = await prisma.order.findUnique({
    where: { number: event.orderRef },
    select: { id: true, total: true, currency: true, status: true },
  });

  if (!order) {
    // Unknown order — ack so the provider stops, but log and mutate nothing.
    console.warn(`[webhook:${providerName}] unknown order ref: ${event.orderRef}`);
    return NextResponse.json({ ok: true, note: "unknown order" });
  }

  // 3. Idempotency — dedupe on eventKey. A replay hits the UNIQUE constraint.
  const existing = await prisma.paymentEvent.findUnique({
    where: { eventKey: event.eventKey },
    select: { id: true },
  });
  if (existing) {
    // Already processed — ack and do nothing (replay-safe).
    return NextResponse.json({ ok: true, note: "duplicate" });
  }

  // Record the audit event (rawPayload masked of secrets/PII).
  await prisma.paymentEvent.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerRef: event.providerRef,
      type: event.type,
      rawPayload: maskPayload(event),
      eventKey: event.eventKey,
    },
  });

  // 4. Handle the event type.
  try {
    if (event.type === "payment.succeeded") {
      // AMOUNT CHECK — the paid amount must equal the order total.
      assertPiasters(event.amount, "webhook amount");
      if (event.amount !== order.total || event.currency !== order.currency) {
        // Amount mismatch — flag + do NOT transition to PAID.
        console.error(
          `[webhook:${providerName}] AMOUNT MISMATCH for order ${order.id}: ` +
          `webhook ${event.amount} ${event.currency} vs order ${order.total} ${order.currency}`,
        );
        return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
      }
      await transitionOrderStatus(order.id, "online_payment_succeeded");
    } else if (event.type === "payment.failed") {
      // A failure on a still-pending order cancels it (releases stock via sweep
      // in Phase 4 TTL; here we cancel directly).
      try {
        await transitionOrderStatus(order.id, "cancel");
      } catch {
        // already cancelled/refunded — fine
      }
    }
  } catch (e) {
    if (e instanceof IllegalTransitionError) {
      // e.g. a late webhook on an already-cancelled order — ack, don't 500.
      console.warn(`[webhook:${providerName}] illegal transition ${e.from} --${e.event}-->`);
      return NextResponse.json({ ok: true, note: "illegal transition ignored" });
    }
    throw e;
  }

  return NextResponse.json({ ok: true });
}
