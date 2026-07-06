import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { loadCartForRSC } from "@/lib/cart/repository";
import { formatPrice } from "@/lib/money";
import { messages } from "@/i18n/messages";

export const metadata: Metadata = {
  title: "Bag",
  alternates: { canonical: "/cart" },
};

/**
 * /cart — full-page cart view (fallback to the drawer; also reachable directly).
 * Server Component → read-only cookie access; uses loadCartForRSC so no cookie
 * is written here (Next.js forbids cookie writes in RSC). The cart is created
 * lazily via the API route / server actions when the visitor adds something.
 */
export default async function CartPage() {
  const cart = await loadCartForRSC();

  return (
    <div className="container-brand section-y">
      <h1 className="font-display text-4xl md:text-5xl mb-10 lowercase">{messages.cart.title}</h1>

      {cart.lines.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink-soft">{messages.cart.empty}</p>
          <Link href="/aethra" className="text-meta text-gold hover:text-gold-soft mt-4 inline-block">
            {messages.cart.continueShopping}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_360px]">
          {/* Lines */}
          <ul className="divide-y divide-line border-t border-line">
            {cart.lines.map((line) => (
              <li key={line.id} className="flex gap-4 py-6">
                <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden bg-ivory-deep">
                  {line.image.url && (
                    <Image src={line.image.url} alt={line.image.alt} fill sizes="96px" className="object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between">
                    <span className="font-medium">{line.name}</span>
                    <span className="text-price">{formatPrice(line.lineTotal)}</span>
                  </div>
                  <p className="text-meta mt-1">{line.colorway} · {line.size}</p>
                  <p className="text-meta mt-1 text-ink-soft">
                    {formatPrice(line.unitAmount)} each
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Summary */}
          <aside className="border border-line bg-ivory-deep p-6 lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-meta mb-4">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">{messages.cart.subtotal}</dt>
                <dd className="text-price">{formatPrice(cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">{messages.cart.shipping}</dt>
                <dd className="text-price">
                  {cart.shipping === 0 ? "Free" : formatPrice(cart.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 mt-2 text-base">
                <dt>Total</dt>
                <dd className="text-price">{formatPrice(cart.total)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-ink-soft">
              Checkout is part of the next phase.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
