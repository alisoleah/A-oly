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

/**
 * Escape user-supplied text for safe HTML insertion (security §B — never inject
 * raw user data into HTML). Covers &, <, >, ", '.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the HTML confirmation email body. Pure + testable.
 *
 * Email HTML is table-based with inline styles — email clients (Outlook, Gmail)
 * strip <style> tags and ignore external CSS, so every style is inline. The
 * palette mirrors the brand (ivory field, ink text, bronze accent) but stays
 * conservative for dark-mode email clients (no background images).
 */
export function renderOrderConfirmationHtml(d: OrderEmailData): string {
  const rows = d.items
    .map(
      (i) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #EDE7DC;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1A1A18;">
            ${escapeHtml(i.name)} <span style="color:#4A4A46;">× ${i.qty}</span>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #EDE7DC;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:15px;color:#1A1A18;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
            ${escapeHtml(formatPrice(i.unitAmount * i.qty))}
          </td>
        </tr>`,
    )
    .join("");

  const codNote = d.isCod
    ? `
      <tr><td style="padding:24px 0 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #B8926A;background:#EDE7DC;width:100%;"><tr><td style="padding:16px 20px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;color:#1A1A18;line-height:1.6;">
          <strong style="font-weight:600;">Cash on delivery.</strong><br/>
          Please prepare ${escapeHtml(formatPrice(d.total))} in cash for the courier. Card payment on delivery is not available.
        </td></tr></table>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>aïoly — order ${escapeHtml(d.orderNumber)}</title></head>
<body style="margin:0;padding:0;background:#F7F4EE;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F7F4EE;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#F7F4EE;">
        <!-- Brand -->
        <tr><td style="padding:0 0 32px 0;text-align:center;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:500;color:#1A1A18;letter-spacing:0.1em;">a<span style="color:#B8926A;">ï</span>oly</span>
          <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;color:#4A4A46;letter-spacing:0.16em;text-transform:uppercase;margin-top:6px;">maison de mode</div>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:0 0 8px 0;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1A1A18;line-height:1.6;">
          Dear ${escapeHtml(d.fullName)},
        </td></tr>
        <tr><td style="padding:0 0 24px 0;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1A1A18;line-height:1.6;">
          Thank you for your order <strong style="font-weight:600;">${escapeHtml(d.orderNumber)}</strong>.
        </td></tr>

        <!-- Items -->
        <tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            ${rows}
          </table>
        </td></tr>

        <!-- Total -->
        <tr><td style="padding:16px 0 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #D9D2C5;">
            <tr>
              <td style="padding-top:16px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1A1A18;font-weight:600;">Total</td>
              <td style="padding-top:16px;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:16px;color:#1A1A18;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;">${escapeHtml(formatPrice(d.total))}</td>
            </tr>
          </table>
        </td></tr>

        ${codNote}

        <!-- CTA -->
        <tr><td style="padding:32px 0 8px 0;" align="center">
          <a href="${escapeHtml(d.confirmUrl)}" style="display:inline-block;padding:14px 36px;background:#1A1A18;color:#F7F4EE;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;font-weight:500;">View your order</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:40px 0 16px 0;border-top:1px solid #D9D2C5;margin-top:24px;">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#1A1A18;">— aïoly, maison de mode</p>
          <p style="margin:8px 0 0 0;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:12px;color:#4A4A46;line-height:1.5;">
            Finished by hand in our Cairo atelier.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const subject = (n: string) => `aïoly — order ${n} confirmed`;

/** Send the order confirmation email via the configured provider. */
export async function sendOrderConfirmation(d: OrderEmailData): Promise<SendResult> {
  const body = renderOrderConfirmationEmail(d);
  const html = renderOrderConfirmationHtml(d);

  if (env.EMAIL_PROVIDER === "console") {
    // Dev: render to the log. Snapshot test asserts on the body, not the log.
    console.log(`[email → ${d.email}] ${subject(d.orderNumber)}\n\n${body}`);
    return { delivered: true, preview: body };
  }

  // Production: Resend — sends both text (fallback) and HTML (primary).
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: env.EMAIL_FROM ?? "atelier@aioly.eg",
      to: d.email,
      subject: subject(d.orderNumber),
      text: body,
      html,
    });
    return { delivered: true };
  }

  // Fallback: no provider configured — log a warning but don't fail checkout.
  console.warn("[email] no provider configured; confirmation not sent.");
  return { delivered: false };
}
