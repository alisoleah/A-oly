import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutSchema } from "@/lib/orders/schemas";
import { createOrder, OutOfStockError, PaymentMethodUnavailableError } from "@/lib/orders/create-order";
import { ensureCartToken, loadCart } from "@/lib/cart/repository";
import { sendOrderConfirmation } from "@/lib/email";
import { env } from "@/lib/env";

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

    // Fire the confirmation email (non-blocking; a failure must not break checkout).
    void sendOrderConfirmation({
      orderNumber: order.number,
      email: order.email,
      fullName: parsed.data.contact.fullName,
      total: order.total,
      isCod: order.paymentMethod === "COD",
      confirmUrl: `${env.APP_BASE_URL.replace(/\/$/, "")}/orders/${order.confirmToken}`,
      items: [], // enriched in Phase 6 with snapshot items; safe empty for now
    }).catch((e) => console.error("[email] confirmation send failed:", e));

    return NextResponse.json({ ok: true, order }, { status: 201 });
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
