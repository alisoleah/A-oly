import { test, expect } from "@playwright/test";

/**
 * Phase 3 e2e — checkout & COD (TESTING_GUIDE.md §e2e journey 2).
 *
 * Runs against the built app (mock provider) on Supabase. The journey:
 *  - Add an item, go to checkout, fill contact + delivery, place a COD order.
 *  - Land on the confirmation page with the "prepare EGP {total}" note.
 *  - The order exists in PENDING_COD (verified by the visible status line).
 *
 * The tampered-total test posts a checkout with a bogus total field — the
 * schema ignores it entirely; the order total equals the server computation.
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

async function addOneAndGoToCheckout(page: import("@playwright/test").Page) {
  await page.goto("/aether/column-dress");
  await page.getByRole("button", { name: "Ivory" }).click();
  await page.getByRole("button", { name: /^L$/ }).click();
  await page.getByRole("button", { name: /Add to cart/i }).click();
  // wait for the add to persist (badge), then go to checkout
  await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });
  await page.goto("/checkout");
}

/**
 * Scope label lookups to <main> so the footer newsletter email field (also
 * labelled "Email address") doesn't trigger a strict-mode violation.
 */
function field(page: import("@playwright/test").Page, label: string | RegExp) {
  return page.getByRole("main").getByLabel(label);
}

test.describe("Checkout — COD purchase", () => {
  test("completes a COD order and shows the confirmation page", async ({ page }) => {
    await addOneAndGoToCheckout(page);

    // Step 1: contact
    await field(page, "Full name").fill("Yasmin Adel");
    await field(page, "Email").fill("yasmin@example.com");
    await field(page, "Phone").fill("01012345678");
    await page.getByRole("button", { name: /Continue to delivery/i }).click();

    // Step 2: delivery
    await expect(page.getByText(/delivery/i).first()).toBeVisible();
    await field(page, "City / Area").fill("Zamalek");
    await field(page, "Address").fill("12 26th of July Street, Apt 3");
    await page.getByRole("button", { name: /Continue to payment/i }).click();

    // Step 3: payment — COD is selected, place order
    await expect(page.getByText(/Cash on delivery/i)).toBeVisible();
    await page.getByRole("button", { name: /Place order/i }).click();

    // Confirmation page
    await expect(page).toHaveURL(/\/orders\/.+/, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();
    // COD note present with the server-computed total
    await expect(page.getByText(/prepare EGP/i)).toBeVisible();
    // Order number format
    await expect(page.getByText(/AIY-\d{6}/)).toBeVisible();
    // Status shown as PENDING_COD
    await expect(page.getByText(/PENDING_COD/)).toBeVisible();
  });

  test("shows an empty-cart message on /checkout with no items", async ({ page }) => {
    await page.goto("/checkout");
    // Scope to main so the always-mounted cart drawer's empty state doesn't match.
    await expect(page.getByRole("main").getByText(/your bag is empty/i)).toBeVisible();
  });
});

test.describe("Checkout — tamper resistance", () => {
  test("a client-supplied total is ignored; the order uses the server total", async ({
    page,
  }) => {
    // Add an item via the browser so the cart cookie is established.
    await page.goto("/aether/fluid-shirt");
    await page.getByRole("button", { name: "Ivory" }).click();
    await page.getByRole("button", { name: /^M$/ }).click();
    await page.getByRole("button", { name: /Add to cart/i }).click();
    await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });

    // POST a checkout with a TAMPERED total field. The schema has no `total`,
    // so it's stripped; the order total must equal the server computation.
    // page.request shares the browser context's cookies.
    const res = await page.request.post("/api/checkout", {
      data: {
        contact: { fullName: "Tamper Test", email: "tamper@example.com", phone: "01098765432" },
        delivery: { governorate: "Giza", city: "Sheikh Zayed", addressLine1: "1 Central Street" },
        payment: { method: "COD" },
        idempotencyKey: `tamper-${Date.now()}-${Math.random()}`,
        // The attacker's payload — must be ignored:
        total: 1,
        subtotal: 1,
        shipping: 0,
      },
    });
    const body = await res.json();
    expect(res.status()).toBe(201);
    expect(body.ok).toBe(true);
    // Fluid Shirt is EGP 2,200 = 220000 piasters + 6000 shipping (under 500k threshold)
    // = 226000. Definitely not the attacker's 1.
    expect(body.order.total).toBe(226000);
  });
});
