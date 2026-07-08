"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice, type Piasters } from "@/lib/money";
import { messages } from "@/i18n/messages";
import { generateIdempotencyKey } from "@/lib/orders/identifiers";
import { ShieldIcon, ReturnIcon, PinIcon } from "@/components/ui/Icon";
import { analytics } from "@/lib/analytics";
import type { CartVM } from "@/lib/cart/repository";
import { GOVERNORATES } from "@/lib/orders/schemas";

/**
 * Checkout form — single page, three collapsed steps (contact → delivery →
 * payment) per design-system.md §6. Order summary is server-supplied (props);
 * totals are NEVER computed client-side.
 *
 * The idempotency key is minted once per page mount and reused on retries so a
 * double-submit creates exactly one order. On success we redirect to the
 * token-gated confirmation page.
 */

type Step = "contact" | "delivery" | "payment";
const STEP_ORDER: Step[] = ["contact", "delivery", "payment"];

export function CheckoutForm({ cart }: { cart: CartVM }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const idem = useMemo(() => generateIdempotencyKey(), []);
  const empty = cart.lines.length === 0;

  // Fire begin_checkout once when the checkout loads (GA4/Meta-ready).
  useEffect(() => {
    if (empty) return;
    analytics.beginCheckout(
      cart.lines.map((l) => ({
        id: l.name,
        name: l.name,
        variant: `${l.colorway} · ${l.size}`,
        price: l.unitAmount / 100, // piasters → major EGP
        quantity: l.qty,
      })),
      cart.total / 100,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form state
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    governorate: "Cairo",
    city: "",
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    notes: "",
  });
  const [method, setMethod] = useState<"CARD" | "COD">("COD");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function next() {
    const i = STEP_ORDER.indexOf(step);
    if (i < STEP_ORDER.length - 1) setStep(STEP_ORDER[i + 1]!);
  }
  function back() {
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1]!);
  }

  async function placeOrder() {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: { fullName: form.fullName, email: form.email, phone: form.phone },
          delivery: {
            governorate: form.governorate,
            city: form.city,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            postalCode: form.postalCode,
            notes: form.notes,
          },
          payment: { method },
          idempotencyKey: idem,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        // Online payment: redirect to the provider's hosted checkout.
        // COD: go straight to the confirmation page.
        if (data.paymentRedirectUrl) {
          window.location.href = data.paymentRedirectUrl;
          return;
        }
        router.push(`/orders/${data.order.confirmToken}`);
        return;
      }
      setServerError(data.error ?? messages.errors.generic);
    } catch {
      setServerError(messages.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  if (empty) {
    return (
      <p className="py-16 text-center text-ink-soft">
        {messages.cart.empty}{" "}
        <Link href="/aethra" className="text-gold underline">{messages.cart.continueShopping}</Link>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">
      {/* Left: form steps */}
      <div>
        <StepHeader step={step} />

        {step === "contact" && (
          <div className="mt-6 space-y-4">
            <Input id="fullName" label="Full name" value={form.fullName} onChange={set("fullName")} autoComplete="name" />
            <Input id="email" type="email" label="Email" value={form.email} onChange={set("email")} autoComplete="email" hint="Your order confirmation will be sent here." />
            <Input id="phone" type="tel" label="Phone" value={form.phone} onChange={set("phone")} placeholder="01012345678" autoComplete="tel" hint="Egyptian mobile, for delivery." />
            <Button variant="primary" onClick={next} className="mt-4">Continue to delivery</Button>
          </div>
        )}

        {step === "delivery" && (
          <div className="mt-6 space-y-4">
            <Select id="governorate" label="Governorate" value={form.governorate} onChange={set("governorate")}>
              {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
            <Input id="city" label="City / Area" value={form.city} onChange={set("city")} />
            <Input id="addressLine1" label="Address" value={form.addressLine1} onChange={set("addressLine1")} placeholder="Building, street, area" />
            <Input id="addressLine2" label="Apartment, floor (optional)" value={form.addressLine2} onChange={set("addressLine2")} />
            <Input id="notes" label="Delivery notes (optional)" value={form.notes} onChange={set("notes")} />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button variant="primary" onClick={next}>Continue to payment</Button>
            </div>
          </div>
        )}

        {step === "payment" && (
          <div className="mt-6 space-y-4">
            {/* Two equal-weight payment options */}
            <fieldset className="space-y-3">
              <legend className="text-meta mb-3 sr-only">Payment method</legend>

              <PaymentOption
                selected={method === "CARD"}
                onSelect={() => setMethod("CARD")}
                title={messages.checkout.payByCard}
              >
                <p className="text-xs text-ink-soft">Card, Apple Pay, or Google Pay — wallets show on supported devices.</p>
              </PaymentOption>

              <PaymentOption
                selected={method === "COD"}
                onSelect={() => setMethod("COD")}
                title={messages.checkout.cashOnDelivery}
              >
                <p className="text-xs text-ink-soft">
                  {messages.checkout.codNote.replace("{total}", formatPrice(cart.total as Piasters))}
                </p>
              </PaymentOption>
            </fieldset>

            {serverError && <p className="text-sm text-error">{serverError}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={back}>Back</Button>
              <Button variant="gold" onClick={placeOrder} disabled={submitting} className="flex-1">
                {submitting ? "Placing order…" : messages.checkout.placeOrder}
              </Button>
            </div>

            {/* Trust row */}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft">
              <li className="flex items-center gap-1.5"><ShieldIcon className="h-4 w-4" /> {messages.checkout.trustSecure}</li>
              <li className="flex items-center gap-1.5"><ReturnIcon className="h-4 w-4" /> {messages.checkout.trustReturns}</li>
              <li className="flex items-center gap-1.5"><PinIcon className="h-4 w-4" /> {messages.checkout.trustAtelier}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Right: order summary (sticky) */}
      <aside className="border border-line bg-ivory-deep p-6 lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-meta mb-4">Order summary</h2>
        <ul className="space-y-3">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2 text-sm">
              <span className="text-ink">
                {line.name} <span className="text-ink-soft">× {line.qty}</span>
                <span className="block text-xs text-ink-soft">{line.colorway} · {line.size}</span>
              </span>
              <span className="text-price">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between"><dt className="text-ink-soft">{messages.cart.subtotal}</dt><dd className="text-price">{formatPrice(cart.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-ink-soft">{messages.cart.shipping}</dt><dd className="text-price">{cart.shipping === 0 ? "Free" : formatPrice(cart.shipping)}</dd></div>
          <div className="flex justify-between border-t border-line pt-2 text-base"><dt>Total</dt><dd className="text-price">{formatPrice(cart.total)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <ol className="flex gap-6 text-meta">
      {STEP_ORDER.map((s, i) => (
        <li key={s} className={i <= idx ? "text-ink" : "text-ink-soft"}>
          {i + 1}. {s[0]!.toUpperCase() + s.slice(1)}
        </li>
      ))}
    </ol>
  );
}

/** Radio card for a payment option — equal visual weight (design-system.md §5). */
function PaymentOption({
  selected,
  onSelect,
  title,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors duration-[var(--animate-duration-fast)] ${
        selected ? "border-ink bg-ivory-deep" : "border-line bg-ivory hover:border-ink-soft"
      }`}
    >
      <input
        type="radio"
        name="payment-method"
        checked={selected}
        onChange={onSelect}
        className="mt-1 accent-ink"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block">{children}</span>
      </span>
    </label>
  );
}
