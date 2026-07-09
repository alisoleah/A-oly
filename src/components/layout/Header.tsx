"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { BagIcon, SearchIcon, MenuIcon, CloseIcon } from "@/components/ui/Icon";
import { useCart } from "@/components/cart/CartProvider";
import { useMessages, useLocale } from "@/i18n/MessagesProvider";
import { cn } from "@/lib/cn";

/**
 * Header — transparent over the hero, solid --ivory after scrolling (design-system.md §3).
 * Desktop: wordmark left, nav center, search+cart+locale right.
 * Mobile: wordmark center, menu left, cart right; nav collapses into a sheet.
 *
 * All copy comes from useMessages() (locale-aware). Nav links are locale-prefixed.
 * The locale switcher (EN | ع) rewrites the URL prefix.
 */
export function Header() {
  const messages = useMessages();
  const locale = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { cart, openDrawer } = useCart();
  const cartCount = cart?.itemCount ?? 0;

  // Only collections that have real pages. About/Journal removed (no pages yet).
  const nav = [
    { href: `/${locale}/aether`, label: messages.nav.aether },
    { href: `/${locale}/aethra`, label: messages.nav.aethra },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-[var(--animate-duration-base)] ease-[var(--ease-brand)]",
        scrolled
          ? "bg-ivory border-b border-line"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="container-brand flex h-20 items-center justify-between md:h-24">
        {/* Left (desktop): nav links. Left (mobile): menu button */}
        <div className="flex flex-1 items-center">
          <button
            type="button"
            className="md:hidden -ms-2 p-2 text-ink"
            onClick={() => setMenuOpen(true)}
            aria-label={messages.nav.menu}
            aria-expanded={menuOpen}
          >
            <MenuIcon />
          </button>
          <nav className="hidden md:flex items-center gap-8" aria-label={messages.nav.primaryNav}>
            {nav.slice(0, 2).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-meta text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center: logo. Two instances: sm (mobile) + md (desktop), swapped via
            responsive hidden/block so the size actually scales with the screen.
            pt-2 nudges it down so it reads as sitting lower in the taller bar. */}
        <div className="flex flex-1 justify-center pt-2">
          <span className="md:hidden"><Logo size="sm" /></span>
          <span className="hidden md:block"><Logo size="md" /></span>
        </div>

        {/* Right: locale switcher, search, cart */}
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          <LocaleSwitcher />
          <button
            type="button"
            className="p-2 text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)]"
            aria-label={messages.nav.search}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={openDrawer}
            className="relative p-2 text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)]"
            aria-label={`${messages.nav.cart} (${cartCount})`}
          >
            <BagIcon />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-gold text-ivory text-[10px] font-medium leading-4 text-center tabular-nums">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav sheet */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/20"
            onClick={() => setMenuOpen(false)}
            aria-label={messages.nav.closeMenu}
          />
          <div className="absolute inset-y-0 inline-start-0 w-[min(80vw,320px)] bg-ivory p-6 flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={messages.nav.closeMenu}
                className="p-2"
              >
                <CloseIcon />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label={messages.nav.mobileNav}>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-3 font-display text-2xl lowercase text-ink border-b border-line"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

/**
 * LocaleSwitcher — a compact EN | ع toggle that rewrites the URL's locale prefix.
 * Uses full-page navigation so the cookie + provider update cleanly.
 */
function LocaleSwitcher() {
  const messages = useMessages();
  const locale = useLocale();
  const pathname = usePathname();

  // Swap the /en or /ar prefix in the current path.
  const otherLocale = locale === "en" ? "ar" : "en";
  const segments = pathname.split("/").filter(Boolean);
  // segments[0] should be the current locale ("en" / "ar")
  if (segments[0] === locale) {
    segments[0] = otherLocale;
  }
  const targetPath = "/" + segments.join("/");

  return (
    <Link
      href={targetPath}
      className="text-meta text-ink hover:text-gold transition-colors duration-[var(--animate-duration-fast)] px-2"
      aria-label={locale === "en" ? messages.nav.switchToArabic : messages.nav.switchToEnglish}
    >
      {locale === "en" ? "ع" : "EN"}
    </Link>
  );
}
