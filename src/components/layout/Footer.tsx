import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Messages } from "@/i18n/messages.en";
import type { Locale } from "@/i18n/config";

/**
 * Footer — ivory-deep field, three columns (shop / house / care),
 * newsletter, payment method marks (design-system.md §3).
 *
 * Server component; receives the resolved messages + locale as props (it can't
 * use useMessages because it's not a client component, and the locale param
 * lives in [locale]/layout.tsx which renders this).
 */
export function Footer({ messages, locale }: { messages: Messages; locale: Locale }) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ivory-deep border-t border-line">
      <div className="container-brand py-16 md:py-24">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          {/* Brand + newsletter */}
          <div className="md:col-span-5">
            <Logo size="lg" linked={false} />
            <p className="mt-5 text-meta">{messages.brand.tagline}</p>
            <p className="mt-6 max-w-sm text-ink-soft">{messages.footer.newsletterBody}</p>
            <form className="mt-4 flex max-w-sm" aria-label={messages.footer.newsletter}>
              <input
                type="email"
                required
                placeholder={messages.footer.emailPlaceholder}
                aria-label={messages.footer.emailPlaceholder}
                className="h-12 flex-1 border border-line border-e-0 bg-ivory px-4 text-sm text-ink placeholder:text-ink-soft/70 focus:outline-none focus:border-ink"
              />
              <button
                type="submit"
                className="h-12 px-6 bg-ink text-ivory text-sm font-medium uppercase tracking-[0.1em] hover:bg-ink-soft transition-colors duration-[var(--animate-duration-fast)]"
              >
                {messages.footer.subscribe}
              </button>
            </form>
          </div>

          {/* Link columns */}
          <nav className="md:col-span-2 md:col-start-7" aria-label={messages.footer.shop}>
            <h2 className="text-meta mb-4">{messages.footer.shop}</h2>
            <ul className="space-y-3">
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/aether`}>{messages.footer.links.aether}</Link></li>
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/aethra`}>{messages.footer.links.aethra}</Link></li>
            </ul>
          </nav>
          <nav className="md:col-span-2" aria-label={messages.footer.house}>
            <h2 className="text-meta mb-4">{messages.footer.house}</h2>
            <ul className="space-y-3">
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/about`}>{messages.footer.links.about}</Link></li>
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/journal`}>{messages.footer.links.journal}</Link></li>
            </ul>
          </nav>
          <nav className="md:col-span-2" aria-label={messages.footer.care}>
            <h2 className="text-meta mb-4">{messages.footer.care}</h2>
            <ul className="space-y-3">
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/shipping`}>{messages.footer.links.shipping}</Link></li>
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/sizing`}>{messages.footer.links.sizing}</Link></li>
              <li><Link className="text-ink hover:text-gold transition-colors" href={`/${locale}/contact`}>{messages.footer.links.contact}</Link></li>
            </ul>
          </nav>
        </div>

        {/* Bottom row: payment marks + copyright */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-line pt-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3" aria-label={messages.footer.paymentMethods}>
            <PaymentMark label="Visa" />
            <PaymentMark label="Mastercard" />
            <PaymentMark label="Apple Pay" />
            <PaymentMark label="Google Pay" />
            <PaymentMark label="COD" />
          </div>
          <p className="text-meta">
            © {year} {messages.brand.name} — {messages.brand.tagline}. {messages.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** A small bordered text chip standing in for a payment-network mark. */
function PaymentMark({ label }: { label: string }) {
  return (
    <span className="inline-flex h-6 items-center border border-line bg-ivory px-2 text-[10px] font-medium uppercase tracking-wider text-ink-soft">
      {label}
    </span>
  );
}
