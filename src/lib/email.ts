import { env } from "@/lib/env";
import { formatPrice, type Piasters } from "@/lib/money";

/**
 * Email provider abstraction (CLAUDE.md §Stack).
 *  - console: dev/test (logs the rendered email instead of sending)
 *  - resend: production (wired in Phase 6)
 *
 * User data (name, address, phone) is rendered as plain text — never injected
 * into HTML unsafely (security §B).
 */

export interface OrderEmailData {
  orderNumber: string;
  email: string;
  fullName: string;
  total: Piasters;
  isCod: boolean;
  confirmUrl: string;
  items: { name: string; qty: number; unitAmount: Piasters }[];
}

export interface SendResult {
  delivered: boolean;
  /** In dev, the rendered text for snapshot tests; in prod, undefined. */
  preview?: string;
}

/** Render the plain-text confirmation email body. Pure + testable. */
export function renderOrderConfirmationEmail(d: OrderEmailData): string {
  const lines = [
    `Dear ${d.fullName},`,
    ``,
    `Thank you for your order ${d.orderNumber}.`,
    ``,
    `Items:`,
    ...d.items.map((i) => `  • ${i.name} × ${i.qty} — ${formatPrice(i.unitAmount * i.qty)}`),
    ``,
    `Total: ${formatPrice(d.total)}`,
    ``,
  ];
  if (d.isCod) {
    lines.push(
      `Payment: Cash on delivery.`,
      `Please prepare ${formatPrice(d.total)} in cash for the courier.`,
      ``,
    );
  }
  lines.push(`View your order: ${d.confirmUrl}`, ``, `— aïoly, maison de mode`);
  return lines.join("\n");
}

const subject = (n: string) => `aïoly — order ${n} confirmed`;

/** Send the order confirmation email via the configured provider. */
export async function sendOrderConfirmation(d: OrderEmailData): Promise<SendResult> {
  const body = renderOrderConfirmationEmail(d);

  if (env.EMAIL_PROVIDER === "console") {
    // Dev: render to the log. Snapshot test asserts on the body, not the log.
    console.log(`[email → ${d.email}] ${subject(d.orderNumber)}\n\n${body}`);
    return { delivered: true, preview: body };
  }

  // Production: Resend (Phase 6 wires the real API key + HTML template).
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.EMAIL_FROM ?? "atelier@aioly.eg",
      to: d.email,
      subject: subject(d.orderNumber),
      text: body,
    });
    return { delivered: true };
  }

  // Fallback: no provider configured — log a warning but don't fail checkout.
  console.warn("[email] no provider configured; confirmation not sent.");
  return { delivered: false };
}
