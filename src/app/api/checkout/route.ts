import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/lib/orders/schemas";
import { createOrder, OutOfStockError, PaymentMethodUnavailableError } from "@/lib/orders/create-order";
import { ensureCartToken, loadCart } from "@/lib/cart/repository";
import { sendOrderConfirmation } from "@/lib/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/factory";

/**
 * POST /api/checkout — create an order from the caller's cart.
 *
 * The request body is validated by `checkoutSchema`. Totals are NEVER taken
 * from the request — they're recomputed inside the transaction (non-negotiable).
 * On success returns the order number + confirmation token (the only public
 * handle to the confirmation page).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form for errors.", fields: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  const cartToken = await ensureCartToken();

  try {
    const order = await createOrder(cartToken, parsed.data);

    // Online payments: reserve the payment intent AFTER the order commits, then
    // send the customer to the provider's hosted checkout. COD skips this —
    // the order is already PENDING_COD and the confirmation page is the finish.
    let paymentRedirectUrl: string | undefined;
    if (order.paymentMethod !== "COD") {
      const provider = getPaymentProvider();
      const intent = await provider.createIntent({
        orderId: order.id,
        orderNumber: order.number,
        amount: order.total,
        currency: order.currency,
        email: order.email,
        firstName: parsed.data.contact.fullName.split(" ")[0] ?? "Customer",
      });
      paymentRedirectUrl = intent.redirectUrl;
      // Persist the provider reference for webhook reconciliation.
      await prisma.paymentEvent.create({
        data: {
          orderId: order.id,
          provider: provider.name,
          providerRef: intent.providerRef,
          type: "intent.created",
          rawPayload: JSON.stringify({ providerRef: intent.providerRef }),
          eventKey: `intent_${order.id}`,
        },
      });
    } else {
      // COD: fire the confirmation email (non-blocking).
      void sendOrderConfirmation({
        orderNumber: order.number,
        email: order.email,
        fullName: parsed.data.contact.fullName,
        total: order.total,
        isCod: true,
        confirmUrl: `${env.APP_BASE_URL.replace(/\/$/, "")}/orders/${order.confirmToken}`,
        items: [],
      }).catch((e) => console.error("[email] confirmation send failed:", e));
    }

    return NextResponse.json({ ok: true, order, paymentRedirectUrl }, { status: 201 });
  } catch (e) {
    if (e instanceof OutOfStockError) {
      return NextResponse.json(
        { ok: false, error: e.message, shortage: e.items },
        { status: 409 },
      );
    }
    if (e instanceof PaymentMethodUnavailableError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    // Empty cart etc.
    if (e instanceof Error && /empty/i.test(e.message)) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("checkout error:", e);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/**
 * GET /api/checkout — the order summary the checkout page renders from,
 * with server-computed totals (never trusts client totals).
 */
export async function GET() {
  const token = await ensureCartToken();
  const cart = await loadCart(token);
  return NextResponse.json({ cart });
}
