import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { QuickViewProvider } from "@/components/product/QuickViewProvider";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { AnalyticsScripts } from "@/components/analytics/AnalyticsScripts";
import { messages } from "@/i18n/messages";
import { env } from "@/lib/env";
import "./globals.css";

/**
 * Font wiring (design-system.md §1).
 * next/font self-hosts and exposes CSS vars (--font-inter / --font-cormorant),
 * which globals.css maps into the Tailwind theme as --font-body / --font-display.
 * No external <link> requests → no layout shift, better Lighthouse.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_BASE_URL),
  title: {
    default: `${messages.brand.name} — ${messages.brand.tagline}`,
    template: `%s — ${messages.brand.name}`,
  },
  description:
    "A small wardrobe of considered garments, cut in Como-woven cloth and finished by hand in Cairo. One perfect piece.",
  openGraph: {
    type: "website",
    title: `${messages.brand.name} — ${messages.brand.tagline}`,
    description: messages.brand.promise,
    url: env.APP_BASE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F4EE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="bg-ivory text-ink antialiased">
        <AnalyticsScripts />
        <CartProvider>
          <QuickViewProvider>
            <Header />
            <main className="min-h-[60vh]">{children}</main>
            <Footer />
            <CartDrawer />
            <ScrollToTop />
          </QuickViewProvider>
        </CartProvider>
      </body>
    </html>
  );
}
