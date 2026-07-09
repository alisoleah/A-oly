import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, IBM_Plex_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";
import { messagesEn } from "@/i18n/messages.en";
import { isLocale, dir as getDir, langTag } from "@/i18n/config";
import "./globals.css";

/**
 * ROOT layout — the only place <html> and <body> exist (Next.js requirement).
 *
 * Reads the NEXT_LOCALE cookie (set by middleware) to set <html lang> + <html dir>
 * and pick the right font set. Latin fonts (Inter + Cormorant) always load;
 * IBM Plex Sans Arabic loads for the Arabic subset and is applied via a CSS var
 * swap in globals.css when dir="rtl".
 *
 * All UI chrome (Header/Footer/CartDrawer/QuickViewProvider/MessagesProvider)
 * lives in [locale]/layout.tsx — not here — because it needs the resolved locale
 * param which is only available inside the [locale] segment.
 *
 * Font wiring (design-system.md §1): next/font self-hosts + exposes CSS vars.
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

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL || "http://localhost:3000"),
  title: {
    default: `${messagesEn.brand.name} — ${messagesEn.brand.tagline}`,
    template: `%s — ${messagesEn.brand.name}`,
  },
  description:
    "A small wardrobe of considered garments, cut in Como-woven cloth and finished by hand in Cairo. One perfect piece.",
  openGraph: {
    type: "website",
    title: `${messagesEn.brand.name} — ${messagesEn.brand.tagline}`,
    description: messagesEn.brand.promise,
    url: process.env.APP_BASE_URL || "http://localhost:3000",
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F4EE",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve locale from the cookie middleware sets. Falls back to "en".
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";
  const direction = getDir(locale);

  return (
    <html
      lang={langTag(locale)}
      dir={direction}
      className={`${inter.variable} ${cormorant.variable} ${arabic.variable} overflow-x-hidden`}
    >
      <body className="bg-ivory text-ink antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
