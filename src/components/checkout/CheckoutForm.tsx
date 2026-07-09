"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice, type Piasters } from "@/lib/money";
import { generateIdempotencyKey } from "@/lib/orders/identifiers";
import { ShieldIcon, ReturnIcon, PinIcon } from "@/components/ui/Icon";
import { analytics } from "@/lib/analytics";
import { useMessages, useLocale } from "@/i18n/MessagesProvider";
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
  const messages = useMessages();
  const locale = useLocale();
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
        price: l.unitAmount / 100,
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

  async function submit() {
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
      if (!res.ok) {
        setServerError(data.error ?? messages.errors.generic);
        setSubmitting(false);
        return;
      }
      if (data.paymentRedirectUrl) {
        window.location.href = data.paymentRedirectUrl;
        return;
      }
      router.push(`/orders/${data.order.confirmToken}`);
    } catch {
      setServerError(messages.errors.generic);
      setSubmitting(false);
    }
  }

  if (empty) {
    return (
      <p className="py-16 text-center text-ink-soft">
        {messages.cart.empty}{" "}
        <Link href={`/${locale}/aethra`} className="text-gold underline">{messages.cart.continueShopping}</Link>
      </p>
    );
  }

  const stepLabel: Record<Step, string> = {
    contact: messages.checkout.contact,
    delivery: messages.checkout.delivery,
    payment: messages.checkout.payment,
  };

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
      <div>
        {/* Step indicator */}
        <div className="mb-8 flex gap-2 text-meta">
          {STEP_ORDER.map((s, i) => (
            <span key={s} className={step === s ? "text-ink" : "text-ink-soft"}>
              {i + 1}. {stepLabel[s]}
            </span>
          ))}
        </div>

        {/* Step: contact */}
        {step === "contact" && (
          <div className="space-y-4">
            <Input id="fullName" label={messages.checkout.fullName} value={form.fullName} onChange={set("fullName")} autoComplete="name" />
            <Input id="email" type="email" label={messages.checkout.email} value={form.email} onChange={set("email")} autoComplete="email" hint={messages.checkout.emailHint} />
            <Input id="phone" type="tel" label={messages.checkout.phone} value={form.phone} onChange={set("phone")} placeholder={messages.checkout.phonePlaceholder} autoComplete="tel" hint={messages.checkout.phoneHint} />
            <Button variant="primary" onClick={next} className="mt-4">{messages.checkout.continueToDelivery}</Button>
          </div>
        )}

        {/* Step: delivery */}
        {step === "delivery" && (
          <div className="space-y-4">
            <Select id="governorate" label={messages.checkout.governorate} value={form.governorate} onChange={set("governorate")}>
              {GOVERNORATES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
            <Input id="city" label={messages.checkout.city} value={form.city} onChange={set("city")} />
            <Input id="addressLine1" label={messages.checkout.address} value={form.addressLine1} onChange={set("addressLine1")} placeholder={messages.checkout.addressPlaceholder} />
            <Input id="addressLine2" label={messages.checkout.addressOptional} value={form.addressLine2} onChange={set("addressLine2")} />
            <Input id="notes" label={messages.checkout.notesOptional} value={form.notes} onChange={set("notes")} />
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={back}>{messages.checkout.back}</Button>
              <Button variant="primary" onClick={next}>{messages.checkout.continueToPayment}</Button>
            </div>
          </div>
        )}

        {/* Step: payment */}
        {step === "payment" && (
          <div className="space-y-6">
            <fieldset>
              <legend className="text-meta mb-3 sr-only">{messages.checkout.paymentMethod}</legend>
              <label
                className={`flex cursor-pointer items-start gap-3 border p-4 transition-colors ${method === "CARD" ? "border-ink" : "border-line"}`}
              >
                <input type="radio" name="method" value="CARD" checked={method === "CARD"} onChange={() => setMethod("CARD")} className="mt-1" />
                <span>
                  <span className="block font-medium">{messages.checkout.payByCard}</span>
                  <span className="block text-xs text-ink-soft">{messages.checkout.cardDescription}</span>
                </span>
              </label>
              <label
                className={`mt-3 flex cursor-pointer items-start gap-3 border p-4 transition-colors ${method === "COD" ? "border-ink" : "border-line"}`}
              >
                <input type="radio" name="method" value="COD" checked={method === "COD"} onChange={() => setMethod("COD")} className="mt-1" />
                <span>
                  <span className="block font-medium">{messages.checkout.cashOnDelivery}</span>
                  {method === "COD" && cart.total && (
                    <span className="mt-1 block text-xs text-ink-soft">
                      {messages.checkout.codNote.replace("{total}", formatPrice(cart.total as Piasters))}
                    </span>
                  )}
                </span>
              </label>
            </fieldset>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={back}>{messages.checkout.back}</Button>
              <Button variant="primary" onClick={submit} disabled={submitting}>
                {submitting ? messages.checkout.placingOrder : messages.checkout.placeOrder}
              </Button>
            </div>
            {serverError && <p className="text-sm text-error">{serverError}</p>}
            <ul className="flex flex-wrap gap-4 text-xs text-ink-soft">
              <li className="flex items-center gap-1.5"><ShieldIcon className="h-4 w-4" /> {messages.checkout.trustSecure}</li>
              <li className="flex items-center gap-1.5"><ReturnIcon className="h-4 w-4" /> {messages.checkout.trustReturns}</li>
              <li className="flex items-center gap-1.5"><PinIcon className="h-4 w-4" /> {messages.checkout.trustAtelier}</li>
            </ul>
          </div>
        )}
      </div>

      {/* Order summary */}
      <aside className="border border-line bg-ivory-deep p-6 lg:sticky lg:top-24 lg:self-start">
        <h2 className="text-meta mb-4">{messages.checkout.orderSummary}</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {cart.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2">
              <span>{line.name} <span className="text-ink-soft">×{line.qty}</span></span>
              <span className="text-price">{formatPrice(line.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between"><dt className="text-ink-soft">{messages.cart.subtotal}</dt><dd className="text-price">{formatPrice(cart.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-soft">{messages.cart.shipping}</dt><dd className="text-price">{cart.shipping === 0 ? messages.cart.free : formatPrice(cart.shipping)}</dd></div>
        <div className="flex justify-between border-t border-line pt-2 text-base"><dt>{messages.cart.total}</dt><dd className="text-price">{formatPrice(cart.total)}</dd></div>
      </aside>
    </div>
  );
}
