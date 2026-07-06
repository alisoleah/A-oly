import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { loadCartForRSC } from "@/lib/cart/repository";
import { messages } from "@/i18n/messages";

export const metadata: Metadata = {
  title: "Checkout",
  alternates: { canonical: "/checkout" },
};

/**
 * /checkout — single-page checkout. Server component loads the cart (server-
 * computed totals) and hands it to the client form. No totals are ever taken
 * from the client.
 */
export default async function CheckoutPage() {
  const cart = await loadCartForRSC();

  return (
    <div className="container-brand section-y">
      <h1 className="font-display text-4xl md:text-5xl mb-10 lowercase">{messages.checkout.title}</h1>
      <CheckoutForm cart={cart} />
    </div>
  );
}
