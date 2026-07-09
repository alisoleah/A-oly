import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { QuickViewProvider } from "@/components/product/QuickViewProvider";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { MessagesProvider } from "@/i18n/MessagesProvider";
import { getMessages } from "@/i18n/get-messages";
import { locales, isLocale } from "@/i18n/config";

/**
 * [locale]/layout.tsx — the locale-scoped shell.
 *
 * Everything that needs the locale (Header, Footer, cart drawer, quick view,
 * messages) lives here, wrapped in MessagesProvider so all client components
 * can access the resolved dictionary via useMessages().
 *
 * generateStaticParams pre-renders both locales at build time.
 */

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);

  return (
    <>
      <AnalyticsScripts />
      <MessagesProvider messages={messages} locale={locale}>
        <CartProvider>
          <QuickViewProvider>
            <Header />
            <main className="min-h-[60vh]">{children}</main>
            <Footer messages={messages} locale={locale} />
            <CartDrawer />
            <ScrollToTop />
          </QuickViewProvider>
        </CartProvider>
      </MessagesProvider>
    </>
  );
}
