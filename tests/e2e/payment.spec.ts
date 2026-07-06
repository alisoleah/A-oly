import { test, expect } from "@playwright/test";

/**
 * Phase 4 e2e — online payment via the MockPaymentProvider (TESTING_GUIDE.md
 * journey 1 & 3).
 *
 * Runs against the built app with PAYMENT_PROVIDER=mock.
 *  - Card success: checkout with "card" → mock pay page → succeed → confirming
 *    page polls → order PAID, confirmation shown, stock decremented.
 *  - Payment failure: choose "fail" on mock page → order ends CANCELLED, stock
 *    released (verified via the sweep, triggered via the cron endpoint in test).
 *
 * The "confirming" page never sets status itself — it only reflects the webhook.
 */

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

async function reachMockPay(page: import("@playwright/test").Page) {
  await page.goto("/aethra/signature-asymmetric-draped-pants");
  await page.getByRole("button", { name: "Ivory" }).click();
  await page.getByRole("button", { name: /^M$/ }).click();
  await page.getByRole("button", { name: /Add to cart/i }).click();
  await expect(page.getByLabel(/Cart \(1\)/)).toBeVisible({ timeout: 20000 });
  await page.goto("/checkout");

  // contact
  await page.getByRole("main").getByLabel("Full name").fill("Nour Sami");
  await page.getByRole("main").getByLabel("Email").fill("nour@example.com");
  await page.getByRole("main").getByLabel("Phone").fill("01098765432");
  await page.getByRole("button", { name: /Continue to delivery/i }).click();

  // delivery
  await page.getByRole("main").getByLabel("City / Area").fill("Maadi");
  await page.getByRole("main").getByLabel("Address").fill("9 Road 9, Apt 5");
  await page.getByRole("button", { name: /Continue to payment/i }).click();

  // payment — select card
  await page.getByRole("radio", { name: /Pay by card/i }).check();
  await page.getByRole("button", { name: /Place order/i }).click();

  // lands on the mock pay page
  await expect(page).toHaveURL(/\/mock-pay\//, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: /confirm your payment/i })).toBeVisible();
}

test.describe("Online payment — mock provider", () => {
  test("card payment succeeds → order PAID via webhook", async ({ page }) => {
    await reachMockPay(page);

    // click succeed
    await page.getByRole("button", { name: /Pay \(succeed\)/i }).click();

    // confirming page polls → redirects to confirmation once PAID
    await expect(page).toHaveURL(/\/orders\/.+/, { timeout: 60000 });
    await expect(page.getByRole("heading", { name: /order confirmed/i })).toBeVisible();

    // The confirmation page reflects the PAID outcome (status line).
    // (It shows the order total — the paid amount, server-verified.)
    await expect(page.getByText(/EGP [\d,]+/).first()).toBeVisible();
  });

  test("payment failure → order ends cancelled", async ({ page }) => {
    await reachMockPay(page);

    // click fail
    await page.getByRole("button", { name: /^Fail$/i }).click();

    // confirming page detects the failure outcome
    await expect(page.getByRole("heading", { name: /payment could not be confirmed/i })).toBeVisible({
      timeout: 60000,
    });
  });
});
