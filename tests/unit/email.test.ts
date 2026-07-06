import { describe, expect, it } from "vitest";
import { renderOrderConfirmationEmail } from "@/lib/email";

/**
 * Email rendering tests (TESTING_GUIDE.md: one happy-path snapshot per template).
 * User data is rendered as plain text — never HTML-injected.
 */
describe("order confirmation email", () => {
  const data = {
    orderNumber: "AIY-000042",
    email: "amira@example.com",
    fullName: "Amira Hassan",
    total: 6600 as const, // 66.00 EGP in piasters for a tidy snapshot
    isCod: true,
    confirmUrl: "https://aioly.eg/orders/abc123",
    items: [
      { name: "Fluid Shirt", qty: 2, unitAmount: 2200 as const },
    ],
  };

  it("renders a stable, readable plain-text body", () => {
    const body = renderOrderConfirmationEmail(data);
    expect(body).toMatchSnapshot();
  });

  it("includes the order number, total, and COD note", () => {
    const body = renderOrderConfirmationEmail(data);
    expect(body).toContain("AIY-000042");
    // formatPrice omits decimals for whole-piaster amounts: 6600 → "EGP 66"
    expect(body).toContain("Total: EGP 66");
    expect(body).toContain("Cash on delivery");
    expect(body).toContain("prepare EGP 66 in cash");
  });

  it("lists each line item with its qty and line total", () => {
    const body = renderOrderConfirmationEmail(data);
    expect(body).toContain("Fluid Shirt × 2 — EGP 44");
  });

  it("omits the COD note for non-COD orders", () => {
    const body = renderOrderConfirmationEmail({ ...data, isCod: false });
    expect(body).not.toContain("Cash on delivery");
  });

  it("escapes nothing dangerous — body is plain text (no HTML)", () => {
    const body = renderOrderConfirmationEmail({
      ...data,
      fullName: "Amira <script>alert(1)</script>",
    });
    // Plain text means the literal string survives; there's no HTML context.
    // The key safety property: this body is sent as text/plain, not text/html.
    expect(body).toContain("Dear Amira <script>alert(1)</script>");
    expect(body).not.toMatch(/<html|<body/i);
  });
});
