import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/money";
import { messages } from "@/i18n/messages";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false }, // private per-order page
};

/**
 * /orders/[token] — order confirmation page.
 *
 * Privacy §F: requires the UNGUESSABLE confirmToken (32 bytes), NOT just the
 * order number. The token is emailed + shown once after checkout; guessing it
 * is infeasible. Robots noindex keeps it out of search.
 *
 * COD orders show the "prepare EGP {total} for the courier" note. Phase 4 adds
 * the "confirming your payment…" polling state for online payments.
 */
export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const order = await prisma.order.findUnique({
    where: { confirmToken: token },
    select: {
      number: true,
      email: true,
      status: true,
      total: true,
      paymentMethod: true,
      items: { select: { nameSnapshot: true, colorwaySnapshot: true, sizeSnapshot: true, qty: true, unitAmountSnapshot: true } },
    },
  });

  if (!order) notFound();

  const isCod = order.paymentMethod === "COD";

  return (
    <div className="container-brand section-y">
      <div className="mx-auto max-w-2xl">
        <p className="text-meta mb-3">{messages.order.number} {order.number}</p>
        <h1 className="font-display text-4xl md:text-5xl mb-4 lowercase">
          {messages.order.confirmed}
        </h1>
        <p className="text-ink-soft mb-8">
          {messages.order.confirmedBody.replace("{email}", order.email)}
        </p>

        {isCod && (
          <div className="border border-gold bg-ivory-deep p-5 mb-8">
            <p className="text-sm">
              {messages.order.codPrepare.replace("{total}", formatPrice(order.total))}
            </p>
          </div>
        )}

        {/* Items */}
        <div className="border-t border-line">
          <ul className="divide-y divide-line">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-2 py-3 text-sm">
                <span>
                  {item.nameSnapshot}
                  <span className="text-ink-soft"> × {item.qty}</span>
                  <span className="block text-xs text-ink-soft">{item.colorwaySnapshot} · {item.sizeSnapshot}</span>
                </span>
                <span className="text-price">{formatPrice(item.unitAmountSnapshot * item.qty)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex justify-between border-t border-line pt-4 text-base">
          <span>Total</span>
          <span className="text-price">{formatPrice(order.total)}</span>
        </div>

        <div className="mt-10">
          <Button href="/aethra" variant="ghost">{messages.cart.continueShopping}</Button>
        </div>

        <p className="mt-6 text-xs text-ink-soft">
          Status: <span className="tabular-nums">{order.status}</span>
        </p>
      </div>
    </div>
  );
}
