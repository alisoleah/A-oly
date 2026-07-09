"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages, useLocale } from "@/i18n/MessagesProvider";

/**
 * Polls the order status every ~1.5s and reflects the webhook outcome.
 *  - PENDING_PAYMENT: keep showing "confirming…"
 *  - PAID: redirect to the confirmation page (success)
 *  - CANCELLED/other: show a gentle failure message
 *
 * The page itself performs NO status mutation — pure read + reflect.
 */
export function ConfirmingClient({ token }: { token: string }) {
  const router = useRouter();
  const messages = useMessages();
  const locale = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/status?token=${token}`, { cache: "no-store" });
        const data = (await res.json()) as { status: string };
        if (stopped) return;
        if (data.status === "PAID") {
          router.push(`/${locale}/orders/${token}`);
          return;
        }
        if (data.status === "CANCELLED" || data.status === "REFUNDED") {
          setFailed(true);
          return;
        }
        // still pending — poll again
        setTimeout(poll, 1500);
      } catch {
        setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [token, router, locale]);

  if (failed) {
    return (
      <div className="container-brand section-y text-center">
        <h1 className="font-display text-3xl mb-3 lowercase">{messages.errors.paymentNotConfirmed}</h1>
        <p className="text-ink-soft mb-6">{messages.errors.paymentFailed}</p>
      </div>
    );
  }

  return (
    <div className="container-brand section-y flex flex-col items-center text-center">
      {/* Subtle gold progress — never claims success until PAID */}
      <div className="mb-6 h-1 w-32 overflow-hidden bg-line">
        <div className="h-1 w-1/2 animate-pulse bg-gold" />
      </div>
      <p className="text-meta">{messages.checkout.confirming}</p>
    </div>
  );
}
