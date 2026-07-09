"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/Icon";
import { formatPrice } from "@/lib/money";
import { useMessages, useLocale } from "@/i18n/MessagesProvider";
import { cn } from "@/lib/cn";

/**
 * CartDrawer (design-system.md §5):
 *  - right side (left in RTL), ivory, 420px
 *  - hairline divider rows
 *  - subtotal + gold "checkout" button
 *  - free-shipping progress line in --ink-soft
 *
 * Reads from the CartProvider (which mirrors the server source of truth).
 * Mutations call the server actions and then refresh from the server.
 */
export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, setQty, remove } = useCart();
  const messages = useMessages();
  const locale = useLocale();

  // Lock body scroll while open + close on Escape.
  useEffectEscape(closeDrawer, drawerOpen);
  useEffectScrollLock(drawerOpen);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-[var(--animate-duration-base)]",
        drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!drawerOpen}
    >
      {/* Scrim */}
      <button
        type="button"
        className="absolute inset-0 bg-ink/20"
        onClick={closeDrawer}
        aria-label={messages.cart.closeCart}
        tabIndex={drawerOpen ? 0 : -1}
      />

      {/* Panel — right side (left in RTL), 420px */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={messages.cart.title}
        className={cn(
          "absolute inset-y-0 inline-end-0 flex w-[min(100vw,420px)] flex-col bg-ivory shadow-xl transition-transform duration-[var(--animate-duration-base)] ease-[var(--ease-brand)]",
          drawerOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-meta">{messages.cart.title}</h2>
          <button type="button" onClick={closeDrawer} aria-label={messages.cart.close} className="p-1">
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto">
          {!cart || cart.lines.length === 0 ? (
            <p className="px-6 py-16 text-center text-ink-soft">{messages.cart.empty}</p>
          ) : (
            <ul>
              {cart.lines.map((line) => (
                <li key={line.id} className="border-b border-line px-6 py-4">
                  <div className="flex gap-4">
                    <div className="relative aspect-[4/5] w-16 shrink-0 overflow-hidden bg-ivory-deep">
                      {line.image.url && (
                        <Image
                          src={line.image.url}
                          alt={line.image.alt}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <span className="text-sm font-medium text-ink">{line.name}</span>
                        <p className="text-price text-sm">{formatPrice(line.lineTotal)}</p>
                      </div>
                      <p className="text-meta mt-0.5">
                        {line.colorway} · {line.size}
                      </p>

                      <div className="mt-auto flex items-center justify-between pt-2">
                        {/* Quantity stepper — pill */}
                        <div className="flex items-center border border-line">
                          <StepperBtn
                            label={messages.cart.decreaseQty}
                            disabled={line.qty <= 1}
                            onClick={() => void setQty(line.variantId, line.qty - 1)}
                          >
                            <MinusIcon className="h-3.5 w-3.5" />
                          </StepperBtn>
                          <span className="min-w-8 px-1 text-center text-sm tabular-nums">
                            {line.qty}
                          </span>
                          <StepperBtn
                            label={messages.cart.increaseQty}
                            disabled={line.qty >= line.maxQty}
                            onClick={() => void setQty(line.variantId, line.qty + 1)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </StepperBtn>
                        </div>
                        <button
                          type="button"
                          onClick={() => void remove(line.variantId)}
                          className="text-meta text-ink-soft hover:text-error"
                        >
                          {messages.cart.remove}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer: free-shipping progress + subtotal + checkout */}
        {cart && cart.lines.length > 0 && (
          <footer className="border-t border-line px-6 py-4">
            <FreeShippingProgress
              remaining={cart.freeShippingRemaining}
              subtotal={cart.subtotal}
              threshold={cart.freeShippingThreshold}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-ink-soft">{messages.cart.subtotal}</span>
              <span className="text-price text-lg">{formatPrice(cart.subtotal)}</span>
            </div>
            <Button href={`/${locale}/checkout`} variant="gold" className="mt-4 w-full">
              {messages.cart.checkout}
            </Button>
            <button
              type="button"
              onClick={closeDrawer}
              className="mt-3 block w-full text-center text-meta text-ink-soft hover:text-ink"
            >
              {messages.cart.continueShopping}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}

function StepperBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function FreeShippingProgress({
  remaining,
  subtotal,
  threshold,
}: {
  remaining: number;
  subtotal: number;
  threshold: number;
}) {
  const messages = useMessages();
  const unlocked = remaining <= 0;
  const pct = threshold > 0 ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 100;
  return (
    <div className="text-sm text-ink-soft">
      <p className="mb-1.5">
        {unlocked
          ? messages.cart.freeShippingEarned
          : messages.cart.freeShippingProgress.replace(
              "{remaining}",
              formatPrice(remaining),
            )}
      </p>
      <div className="h-px w-full bg-line">
        <div
          className="h-px bg-gold transition-all duration-[var(--animate-duration-base)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- small effect hooks kept local to avoid extra files ---
function useEffectEscape(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
}
function useEffectScrollLock(open: boolean) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
}
