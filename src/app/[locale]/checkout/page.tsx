import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { loadCartForRSC } from "@/lib/cart/repository";
import { getMessages } from "@/i18n/get-messages";
import type { Locale } from "@/i18n/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Checkout",
    alternates: { canonical: `/${locale}/checkout`, languages: { en: "/en/checkout", ar: "/ar/checkout" } },
  };
}

/**
 * /checkout — single-page checkout. Server component loads the cart (server-
 * computed totals) and hands it to the client form. No totals are ever taken
 * from the client.
 */
export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = getMessages(locale as Locale);
  const cart = await loadCartForRSC();

  return (
    <div className="container-brand section-y">
      <h1 className="font-display text-4xl md:text-5xl mb-10 lowercase">{messages.checkout.title}</h1>
      <CheckoutForm cart={cart} />
    </div>
  );
}
